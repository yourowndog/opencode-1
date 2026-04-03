import type { Argv } from "yargs"
import { Database, eq } from "../../storage/db"
import { SessionTable, MessageTable, PartTable, TodoTable } from "../../session/session.sql"
import { EventTable } from "../../sync/event.sql"
import { SyncEvent } from "../../sync"
import { Session } from "../../session"
import { MessageV2 } from "../../session/message-v2"
import { Todo } from "../../session/todo"
import { Log } from "../../util/log"
import { UI } from "../ui"

export const SyncBackfillCommand = {
  command: "backfill",
  describe: "Backfill sync events for legacy sessions",
  builder: (yargs: Argv) => yargs,
  handler: async () => {
    // Enable the flag so events are persisted
    process.env.OPENCODE_EXPERIMENTAL_WORKSPACES = "1"

    UI.println("Starting sync event backfill for legacy sessions...")

    const sessions = Database.use((db) => db.select().from(SessionTable).all())
    let backfilledCount = 0

    for (const sessionRow of sessions) {
      const sessionID = sessionRow.id

      // Check if session already has a created event
      const hasCreatedEvent = Database.use((db) =>
        db.select().from(EventTable).where(eq(EventTable.aggregate_id, sessionID)).get()
      )

      if (hasCreatedEvent) {
        continue // Skip, already has events
      }

      UI.println(`Backfilling session: ${sessionID}`)

      // 1. Session Created
      const sessionInfo = Session.fromRow(sessionRow)
      SyncEvent.run(Session.Event.Created, {
        sessionID,
        info: sessionInfo,
      })

      // 2. Messages
      const messages = Database.use((db) =>
        db.select().from(MessageTable).where(eq(MessageTable.session_id, sessionID)).all()
      )
      for (const msgRow of messages) {
        const msgInfo = { id: msgRow.id, sessionID: msgRow.session_id, ...msgRow.data } as MessageV2.Info
        SyncEvent.run(MessageV2.Event.Updated, {
          sessionID,
          info: msgInfo,
        })
      }

      // 3. Parts
      const parts = Database.use((db) =>
        db.select().from(PartTable).where(eq(PartTable.session_id, sessionID)).all()
      )
      for (const partRow of parts) {
        const partInfo = { id: partRow.id, sessionID: partRow.session_id, messageID: partRow.message_id, ...partRow.data } as MessageV2.Part
        SyncEvent.run(MessageV2.Event.PartUpdated, {
          sessionID,
          part: partInfo,
          time: partRow.time_created,
        })
      }

      // 4. Todos
      const todos = Todo.get(sessionID)
      if (todos.length > 0) {
        SyncEvent.run(Todo.Event.Updated, {
          sessionID,
          todos,
        })
      }

      backfilledCount++
    }

    UI.println(`Backfill complete. Processed ${backfilledCount} legacy sessions.`)
    process.exit(0)
  },
}

export const SyncCommand = {
  command: "sync",
  describe: "Manage session synchronization",
  builder: (yargs: Argv) => yargs.command(SyncBackfillCommand).demandCommand(),
  handler: () => {},
}
