import { Hono } from "hono"
import { basicAuth } from "hono/basic-auth"
import { cors } from "hono/cors"
import { z } from "zod"
import { initDb, sync_event, sync_cursor } from "./db"
import { eq, gt, sql } from "drizzle-orm"

const app = new Hono()
const db = initDb()

const username = process.env.OPENCODE_SERVER_USERNAME || "opencode"
const password = process.env.OPENCODE_SERVER_PASSWORD

if (!password) {
  console.warn("WARNING: OPENCODE_SERVER_PASSWORD is not set. Auth will fail.")
}

app.use("*", cors())

app.use(
  "*",
  basicAuth({
    username,
    password: password || "UNSET",
  })
)

const EventSchema = z.object({
  id: z.string(),
  aggregateID: z.string(),
  seq: z.number(),
  type: z.string(),
  data: z.record(z.unknown()),
})

const PushSchema = z.object({
  source: z.string(),
  events: z.array(EventSchema),
})

app.post("/sync/push", async (c) => {
  const body = await c.req.json()
  const parsed = PushSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: "Invalid payload", details: parsed.error }, 400)
  }

  const { source, events } = parsed.data
  if (events.length === 0) {
    return c.json({ accepted: 0, cursor: 0 })
  }

  let accepted = 0
  let maxCursor = 0

  try {
    await db.transaction(async (tx) => {
      for (const evt of events) {
        // Check if event already exists
        const existing = await tx.select({ id: sync_event.id }).from(sync_event).where(eq(sync_event.id, evt.id)).get()
        if (existing) continue

        // Validate sequence
        const lastEvt = await tx
          .select({ seq: sync_event.seq })
          .from(sync_event)
          .where(eq(sync_event.aggregate_id, evt.aggregateID))
          .orderBy(sql`seq DESC`)
          .limit(1)
          .get()

        const lastSeq = lastEvt ? lastEvt.seq : -1
        if (evt.seq !== lastSeq + 1) {
          throw new Error(`Sequence mismatch for aggregate ${evt.aggregateID}: expected ${lastSeq + 1}, got ${evt.seq}`)
        }

        // Insert
        const result = await tx.insert(sync_event).values({
          id: evt.id,
          aggregate_id: evt.aggregateID,
          seq: evt.seq,
          type: evt.type,
          data: JSON.stringify(evt.data),
          source,
          time_received: Date.now(),
        }).returning({ cursor: sync_event.cursor }).get()

        accepted++
        if (result && result.cursor > maxCursor) {
          maxCursor = result.cursor
        }
      }
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }

  // If no new events were inserted, get the current max cursor
  if (maxCursor === 0) {
    const max = await db.select({ cursor: sql<number>`MAX(cursor)` }).from(sync_event).get()
    maxCursor = max?.cursor || 0
  }

  return c.json({ accepted, cursor: maxCursor })
})

app.get("/sync/pull", async (c) => {
  const cursorParam = c.req.query("cursor")
  const cursor = cursorParam ? parseInt(cursorParam, 10) : 0

  if (isNaN(cursor)) {
    return c.json({ error: "Invalid cursor" }, 400)
  }

  const limit = 1000
  const rows = await db
    .select()
    .from(sync_event)
    .where(gt(sync_event.cursor, cursor))
    .orderBy(sync_event.cursor)
    .limit(limit + 1)
    .all()

  const hasMore = rows.length > limit
  const eventsToReturn = hasMore ? rows.slice(0, limit) : rows

  const events = eventsToReturn.map((row) => ({
    id: row.id,
    aggregateID: row.aggregate_id,
    seq: row.seq,
    type: row.type,
    data: JSON.parse(row.data),
  }))

  const nextCursor = eventsToReturn.length > 0 ? eventsToReturn[eventsToReturn.length - 1].cursor : cursor

  return c.json({ events, cursor: nextCursor, hasMore })
})

app.get("/sync/sessions", async (c) => {
  const rows = await db
    .select({
      aggregate_id: sync_event.aggregate_id,
      latest_seq: sql<number>`MAX(seq)`,
      event_count: sql<number>`COUNT(*)`,
    })
    .from(sync_event)
    .groupBy(sync_event.aggregate_id)
    .all()

  return c.json({ sessions: rows })
})

app.get("/sync/health", async (c) => {
  const eventCount = await db.select({ count: sql<number>`COUNT(*)` }).from(sync_event).get()
  const sessionCount = await db.select({ count: sql<number>`COUNT(DISTINCT aggregate_id)` }).from(sync_event).get()

  return c.json({
    ok: true,
    version: "0.1.0",
    events: eventCount?.count || 0,
    sessions: sessionCount?.count || 0,
  })
})

const port = process.env.SYNC_PORT ? parseInt(process.env.SYNC_PORT, 10) : 3001
console.log(`Starting sync server on port ${port}`)

export default {
  port,
  fetch: app.fetch,
}
