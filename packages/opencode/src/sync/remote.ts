import { Config } from "@/config/config"
import { Database, eq, gt, count, sql } from "@/storage/db"
import { EventTable } from "./event.sql"
import { SyncStateTable } from "./state.sql"
import { SyncEvent } from "./index"

export namespace SyncRemote {
  const KEY_PUSH = "last_push_cursor"
  const KEY_PULL = "last_pull_cursor"

  function getState(key: string): string | undefined {
    const row = Database.use((db) =>
      db.select({ value: SyncStateTable.value }).from(SyncStateTable).where(eq(SyncStateTable.key, key)).get(),
    )
    return row?.value
  }

  function setState(key: string, value: string) {
    Database.use((db) =>
      db
        .insert(SyncStateTable)
        .values({ key, value })
        .onConflictDoUpdate({ target: SyncStateTable.key, set: { value } })
        .run(),
    )
  }

  function setError(error: string) {
    const now = Date.now()
    Database.use((db) =>
      db
        .insert(SyncStateTable)
        .values([
          { key: "last_error", value: error },
          { key: "last_error_time", value: String(now) },
        ])
        .onConflictDoUpdate({ target: SyncStateTable.key, set: { value: sql.raw("excluded.value") } })
        .run(),
    )
  }

  function clearError() {
    Database.use((db) =>
      db
        .delete(SyncStateTable)
        .where(sql`key IN ('last_error', 'last_error_time')`)
        .run(),
    )
  }

  function headers(cfg: NonNullable<Config.Info["sync"]>): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" }
    if (cfg.auth) {
      const creds = btoa(`${cfg.auth.username}:${cfg.auth.password}`)
      h["Authorization"] = `Basic ${creds}`
    }
    return h
  }

  export async function push(): Promise<{ pushed: number; error?: string }> {
    const cfg = (await Config.get()).sync
    if (!cfg?.enabled || !cfg.server) return { pushed: 0 }

    const lastPushedId = getState(KEY_PUSH)

    // Get unpushed events (after lastPushedId if tracking, or all if not)
    const events = Database.use((db) => {
      const baseQuery = db
        .select({
          id: EventTable.id,
          aggregate_id: EventTable.aggregate_id,
          seq: EventTable.seq,
          type: EventTable.type,
          data: EventTable.data,
        })
        .from(EventTable)
        
      // If we have a last pushed ID, get events after it
      const filtered = lastPushedId 
        ? baseQuery.where(gt(EventTable.id, lastPushedId))
        : baseQuery
      
      return filtered
        .orderBy(EventTable.id)
        .limit(100) // Limit to prevent huge payloads
        .all()
    })

    if (events.length === 0) return { pushed: 0 }

    // Transform to server format
    const payload = events.map((e) => ({
      id: e.id,
      aggregateID: e.aggregate_id,
      seq: e.seq,
      type: e.type,
      data: e.data,
    }))

    try {
      const res = await fetch(`${cfg.server}/sync/push`, {
        method: "POST",
        headers: headers(cfg),
        body: JSON.stringify({ events: payload, source: cfg.source }),
      })

      if (!res.ok) {
        const text = await res.text()
        const error = `HTTP ${res.status}: ${text}`
        console.warn(`[sync] push failed: ${error}`)
        setError(error)
        return { pushed: 0, error }
      }

      // Update cursor to the ID of the last event we pushed
      const lastId = events[events.length - 1].id
      setState(KEY_PUSH, lastId)
      clearError()

      return { pushed: events.length }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[sync] push error: ${msg}`)
      setError(msg)
      return { pushed: 0, error: msg }
    }
  }

  export async function pull(): Promise<{ pulled: number; error?: string }> {
    const cfg = (await Config.get()).sync
    if (!cfg?.enabled || !cfg.server) return { pulled: 0 }

    let total = 0
    let cursor = parseInt(getState(KEY_PULL) || "0", 10)
    let more = true

    while (more) {
      try {
        const res = await fetch(`${cfg.server}/sync/pull?cursor=${cursor}`, {
          method: "GET",
          headers: headers(cfg),
        })

        if (!res.ok) {
          const text = await res.text()
          console.warn(`[sync] pull failed: ${res.status} ${text}`)
          return { pulled: total, error: `HTTP ${res.status}` }
        }

        const body = (await res.json()) as {
          events: Array<{
            id: string
            aggregateID: string
            seq: number
            type: string
            data: Record<string, unknown>
            source: string
          }>
          cursor: number
          hasMore: boolean
        }

        // Filter out our own events
        const foreign = body.events.filter((e) => e.source !== cfg.source)

        // Replay each event
        for (const evt of foreign) {
          try {
            SyncEvent.replay({
              id: evt.id,
              seq: evt.seq,
              aggregateID: evt.aggregateID,
              type: evt.type,
              data: evt.data,
            })
            total++
          } catch (err) {
            // Log but continue - don't let one bad event stop sync
            console.warn(`[sync] replay error for ${evt.id}: ${err}`)
          }
        }

        cursor = body.cursor
        setState(KEY_PULL, String(cursor))
        more = body.hasMore
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`[sync] pull error: ${msg}`)
        return { pulled: total, error: msg }
      }
    }

    return { pulled: total }
  }

  export async function status(): Promise<{
    enabled: boolean
    pending: number
    lastPull: number
    lastPush: number
    lastError?: string
    lastErrorTime?: number
  }> {
    const cfg = (await Config.get()).sync
    if (!cfg?.enabled) {
      return { enabled: false, pending: 0, lastPull: 0, lastPush: 0 }
    }

    const lastPushedId = getState(KEY_PUSH)
    const pull = parseInt(getState(KEY_PULL) || "0", 10)
    const lastError = getState("last_error")
    const lastErrorTime = getState("last_error_time")

    // Count unpushed events
    const pending = Database.use((db) => {
      const baseQuery = db
        .select({ cnt: count(EventTable.id) })
        .from(EventTable)
        
      // If we have a last pushed ID, count events after it
      const filtered = lastPushedId 
        ? baseQuery.where(gt(EventTable.id, lastPushedId))
        : baseQuery
      
      const row = filtered.get()
      return row?.cnt ?? 0
    })

    // For backwards compatibility, we'll return 0 for lastPush when using ID-based tracking
    return { 
      enabled: true, 
      pending, 
      lastPull: pull, 
      lastPush: 0,
      lastError,
      lastErrorTime: lastErrorTime ? parseInt(lastErrorTime, 10) : undefined
    }
  }
}
