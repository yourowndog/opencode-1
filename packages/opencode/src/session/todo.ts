import { BusEvent } from "@/bus/bus-event"
import { Bus } from "@/bus"
import { SessionID } from "./schema"
import z from "zod"
import { Database, eq, asc } from "../storage/db"
import { TodoTable } from "./session.sql"
import { SyncEvent } from "@/sync"
import { Effect } from "effect"

export namespace Todo {
  export const Info = z
    .object({
      content: z.string().describe("Brief description of the task"),
      status: z.string().describe("Current status of the task: pending, in_progress, completed, cancelled"),
      priority: z.string().describe("Priority level of the task: high, medium, low"),
    })
    .meta({ ref: "Todo" })
  export type Info = z.infer<typeof Info>

  export namespace Event {
    export const Updated = SyncEvent.define({
      type: "todo.updated",
      version: 1,
      aggregate: "sessionID",
      schema: z.object({
        sessionID: SessionID.zod,
        todos: z.array(Info),
      }),
    })
  }

  export function update(input: { sessionID: SessionID; todos: Info[] }) {
    SyncEvent.run(Event.Updated, { sessionID: input.sessionID, todos: input.todos })
    Bus.publish(Event.Updated, input)
  }

  export function get(sessionID: SessionID) {
    const rows = Database.use((db) =>
      db.select().from(TodoTable).where(eq(TodoTable.session_id, sessionID)).orderBy(asc(TodoTable.position)).all(),
    )
    return rows.map((row: any) => ({
      content: row.content,
      status: row.status,
      priority: row.priority,
    }))
  }
}
