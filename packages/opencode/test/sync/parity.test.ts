import { describe, expect, test } from "bun:test"
import path from "path"
import "../../src/server/projectors"
import { Session } from "../../src/session"
import { MessageV2 } from "../../src/session/message-v2"
import { Todo } from "../../src/session/todo"
import { MessageID, PartID } from "../../src/session/schema"
import { Instance } from "../../src/project/instance"
import { Database, eq } from "../../src/storage/db"
import { EventTable, EventSequenceTable } from "../../src/sync/event.sql"
import { SessionTable, MessageTable, PartTable, TodoTable } from "../../src/session/session.sql"
import { SyncEvent } from "../../src/sync"
import { Log } from "../../src/util/log"
import { Flag } from "../../src/flag/flag"

const projectRoot = path.join(__dirname, "../..")
Log.init({ print: false })

describe("Sync Parity", () => {
  test("should rebuild empty DB from event log", async () => {
    // Enable the flag so events are persisted
    process.env.OPENCODE_EXPERIMENTAL_WORKSPACES = "1"
    
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        // 1. Create state
        const session = await Session.create({ title: "Parity Test Session" })
        
        const messageID = MessageID.ascending()
        await Session.updateMessage({
          id: messageID,
          sessionID: session.id,
          role: "user",
          time: { created: Date.now() },
          agent: "user",
          model: { providerID: "test", modelID: "test" },
          tools: {},
          mode: "",
        } as unknown as MessageV2.Info)

        const partID = PartID.ascending()
        await Session.updatePart({
          id: partID,
          messageID,
          sessionID: session.id,
          type: "text",
          text: "Hello world",
        } as unknown as MessageV2.Part)

        Todo.update({
          sessionID: session.id,
          todos: [{ content: "Test todo", status: "pending", priority: "high" }]
        })

        // Wait for events to be processed
        await new Promise((resolve) => setTimeout(resolve, 100))

        // 2. Capture event log for this session
        const events = Database.use((db) =>
          db.select().from(EventTable).where(eq(EventTable.aggregate_id, session.id)).all()
        )
        
        expect(events.length).toBeGreaterThan(0)

        // 3. Capture projected state
        const originalSession = Database.use((db) => db.select().from(SessionTable).where(eq(SessionTable.id, session.id)).get())
        const originalMessages = Database.use((db) => db.select().from(MessageTable).where(eq(MessageTable.session_id, session.id)).all())
        const originalParts = Database.use((db) => db.select().from(PartTable).where(eq(PartTable.session_id, session.id)).all())
        const originalTodos = Database.use((db) => db.select().from(TodoTable).where(eq(TodoTable.session_id, session.id)).all())

        expect(originalSession).toBeDefined()
        expect(originalMessages.length).toBe(1)
        expect(originalParts.length).toBe(1)
        expect(originalTodos.length).toBe(1)

        // 4. Clear domain tables for this session
        Database.use((db) => {
          db.delete(SessionTable).where(eq(SessionTable.id, session.id)).run()
          db.delete(MessageTable).where(eq(MessageTable.session_id, session.id)).run()
          db.delete(PartTable).where(eq(PartTable.session_id, session.id)).run()
          db.delete(TodoTable).where(eq(TodoTable.session_id, session.id)).run()
          db.delete(EventSequenceTable).where(eq(EventSequenceTable.aggregate_id, session.id)).run()
        })

        // Verify cleared
        expect(Database.use((db) => db.select().from(SessionTable).where(eq(SessionTable.id, session.id)).get())).toBeUndefined()

        // 5. Replay events
        for (const event of events) {
          SyncEvent.replay({
            id: event.id,
            seq: event.seq,
            aggregateID: event.aggregate_id,
            type: event.type,
            data: event.data as any,
          })
        }

        // Wait for replay to process
        await new Promise((resolve) => setTimeout(resolve, 100))

        // 6. Assert state matches
        const replayedSession = Database.use((db) => db.select().from(SessionTable).where(eq(SessionTable.id, session.id)).get())
        const replayedMessages = Database.use((db) => db.select().from(MessageTable).where(eq(MessageTable.session_id, session.id)).all())
        const replayedParts = Database.use((db) => db.select().from(PartTable).where(eq(PartTable.session_id, session.id)).all())
        const replayedTodos = Database.use((db) => db.select().from(TodoTable).where(eq(TodoTable.session_id, session.id)).all())

        const omitTimestamps = (obj: any) => {
          if (!obj) return obj
          const { time_updated, time_created, ...rest } = obj
          return rest
        }

        expect(omitTimestamps(replayedSession)).toEqual(omitTimestamps(originalSession))
        expect(replayedMessages.map(omitTimestamps)).toEqual(originalMessages.map(omitTimestamps))
        expect(replayedParts.map(omitTimestamps)).toEqual(originalParts.map(omitTimestamps))
        expect(replayedTodos.map(omitTimestamps)).toEqual(originalTodos.map(omitTimestamps))
        
        // Cleanup
        await Session.remove(session.id)
      },
    })
  })
})
