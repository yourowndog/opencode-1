import { sqliteTable, text } from "drizzle-orm/sqlite-core"

export const SyncStateTable = sqliteTable("sync_state", {
  key: text().primaryKey(),
  value: text().notNull(),
})
