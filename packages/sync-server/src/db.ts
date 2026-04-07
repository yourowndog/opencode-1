import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { Database } from "bun:sqlite"
import path from "path"
import fs from "fs"

export const sync_event = sqliteTable("sync_event", {
  cursor: integer("cursor").primaryKey({ autoIncrement: true }),
  id: text("id").notNull().unique(),
  aggregate_id: text("aggregate_id").notNull(),
  seq: integer("seq").notNull(),
  type: text("type").notNull(),
  data: text("data").notNull(),
  source: text("source").notNull(),
  time_received: integer("time_received").notNull(),
})

export const sync_cursor = sqliteTable("sync_cursor", {
  source: text("source").primaryKey(),
  cursor: integer("cursor").notNull().default(0),
})

export function initDb() {
  const dbPath = process.env.SYNC_DB_PATH || path.join(process.cwd(), "data", "sync.db")
  const dbDir = path.dirname(dbPath)
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  const sqlite = new Database(dbPath)
  sqlite.run("PRAGMA journal_mode = WAL")
  sqlite.run("PRAGMA synchronous = NORMAL")
  sqlite.run("PRAGMA busy_timeout = 5000")
  sqlite.run("PRAGMA cache_size = -64000")
  sqlite.run("PRAGMA foreign_keys = ON")
  sqlite.run("PRAGMA wal_checkpoint(PASSIVE)")

  // Create tables if they don't exist
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS sync_event (
      cursor INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL UNIQUE,
      aggregate_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      type TEXT NOT NULL,
      data TEXT NOT NULL,
      source TEXT NOT NULL,
      time_received INTEGER NOT NULL
    )
  `)

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS sync_cursor (
      source TEXT PRIMARY KEY,
      cursor INTEGER NOT NULL DEFAULT 0
    )
  `)

  return drizzle(sqlite)
}
