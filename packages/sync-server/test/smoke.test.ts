import { expect, test, beforeAll, afterAll } from "bun:test"
import { Database } from "bun:sqlite"
import fs from "fs"
import path from "path"

const PORT = 3002
const DB_PATH = path.join(process.cwd(), "data", "test-sync.db")
const AUTH = "Basic " + Buffer.from("opencode:testpass").toString("base64")

let server: any

beforeAll(async () => {
  // Clean up old test db
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH)
  }

  // Set env vars for server
  process.env.SYNC_PORT = PORT.toString()
  process.env.SYNC_DB_PATH = DB_PATH
  process.env.OPENCODE_SERVER_USERNAME = "opencode"
  process.env.OPENCODE_SERVER_PASSWORD = "testpass"

  // Start server
  const { default: app } = await import("../src/index")
  server = Bun.serve(app)
})

afterAll(() => {
  if (server) server.stop()
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH)
  }
})

test("health check", async () => {
  const res = await fetch(`http://localhost:${PORT}/sync/health`, {
    headers: { Authorization: AUTH },
  })
  expect(res.status).toBe(200)
  const data = await res.json() as any
  expect(data.ok).toBe(true)
  expect(data.events).toBe(0)
})

test("push and pull events", async () => {
  const events = [
    { id: "evt1", aggregateID: "session-1", seq: 0, type: "test.event", data: { foo: "bar" } },
    { id: "evt2", aggregateID: "session-1", seq: 1, type: "test.event", data: { foo: "baz" } },
    { id: "evt3", aggregateID: "session-1", seq: 2, type: "test.event", data: { foo: "qux" } },
  ]

  // Push
  const pushRes = await fetch(`http://localhost:${PORT}/sync/push`, {
    method: "POST",
    headers: {
      Authorization: AUTH,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ source: "test", events }),
  })
  expect(pushRes.status).toBe(200)
  const pushData = await pushRes.json() as any
  expect(pushData.accepted).toBe(3)
  expect(pushData.cursor).toBeGreaterThan(0)

  // Pull
  const pullRes = await fetch(`http://localhost:${PORT}/sync/pull?cursor=0`, {
    headers: { Authorization: AUTH },
  })
  expect(pullRes.status).toBe(200)
  const pullData = await pullRes.json() as any
  expect(pullData.events.length).toBe(3)
  expect(pullData.events[0].id).toBe("evt1")
  expect(pullData.events[2].id).toBe("evt3")
  expect(pullData.hasMore).toBe(false)
})

test("deduplication", async () => {
  const events = [
    { id: "evt3", aggregateID: "session-1", seq: 2, type: "test.event", data: { foo: "qux" } }, // Duplicate
    { id: "evt4", aggregateID: "session-1", seq: 3, type: "test.event", data: { foo: "quux" } }, // New
  ]

  const pushRes = await fetch(`http://localhost:${PORT}/sync/push`, {
    method: "POST",
    headers: {
      Authorization: AUTH,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ source: "test", events }),
  })
  expect(pushRes.status).toBe(200)
  const pushData = await pushRes.json() as any
  expect(pushData.accepted).toBe(1) // Only evt4 accepted
})

test("sequence validation", async () => {
  const events = [
    { id: "evt5", aggregateID: "session-1", seq: 5, type: "test.event", data: {} }, // Missing seq 4
  ]

  const pushRes = await fetch(`http://localhost:${PORT}/sync/push`, {
    method: "POST",
    headers: {
      Authorization: AUTH,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ source: "test", events }),
  })
  expect(pushRes.status).toBe(400)
  const pushData = await pushRes.json() as any
  expect(pushData.error).toContain("Sequence mismatch")
})

test("sessions list", async () => {
  const res = await fetch(`http://localhost:${PORT}/sync/sessions`, {
    headers: { Authorization: AUTH },
  })
  expect(res.status).toBe(200)
  const data = await res.json() as any
  expect(data.sessions.length).toBe(1)
  expect(data.sessions[0].aggregate_id).toBe("session-1")
  expect(data.sessions[0].latest_seq).toBe(3)
  expect(data.sessions[0].event_count).toBe(4)
})
