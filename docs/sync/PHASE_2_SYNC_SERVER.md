# Phase 2: Sync Server

> **Goal**: Build a standalone sync server that runs on beksinski (VPS). It receives events from spokes, stores them, and serves them back. No AI logic — just a dumb event store.
>
> **Depends on**: Phase 1 (event audit) — must know the event types being emitted.
> **Estimated sessions**: 2-3
> **Next**: Phase 3 (Sync Client)

---

## Context

beksinski (142.93.94.124, user `silo`) currently runs stock `opencode serve` v1.3.13 at https://opencode.brokentooth.io with basic auth. The sync server will run alongside it (different port) or replace it — Sam's call at deploy time.

The sync server is intentionally minimal: accept events, store in SQLite, serve them. No AI, no session execution, no plugins.

---

## Step-by-Step Instructions

### Step 1: Scaffold the package

```bash
cd /home/sam/projects/opencode-fork
mkdir -p packages/sync-server/src
```

Create `packages/sync-server/package.json`:
```json
{
  "name": "@opencode-ai/sync-server",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "start": "bun run src/index.ts",
    "typecheck": "bun x tsc --noEmit"
  },
  "dependencies": {
    "hono": "^4.0.0",
    "drizzle-orm": "^0.40.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.0.0"
  }
}
```

Create `packages/sync-server/tsconfig.json` — keep it simple, match the main package's style.

### Step 2: Define the database schema

Create `packages/sync-server/src/db.ts`:

Two tables:

```sql
sync_event:
  cursor    INTEGER PRIMARY KEY AUTOINCREMENT  -- global ordering
  id        TEXT NOT NULL UNIQUE               -- event ID from spoke (dedup key)
  aggregate_id TEXT NOT NULL                   -- session ID (or other aggregate)
  seq       INTEGER NOT NULL                   -- per-aggregate sequence number
  type      TEXT NOT NULL                      -- event type (e.g. "session.created.1")
  data      TEXT NOT NULL                      -- JSON payload
  source    TEXT NOT NULL                      -- spoke hostname (pyrrhus, titan, etc.)
  time_received INTEGER NOT NULL               -- server receipt timestamp (ms)

sync_cursor:
  source    TEXT PRIMARY KEY                   -- spoke hostname
  cursor    INTEGER NOT NULL DEFAULT 0         -- last cursor this spoke pulled up to
```

Use Drizzle ORM with `bun:sqlite` driver, matching the main opencode package's pattern. Apply WAL mode and performance PRAGMAs.

### Step 3: Implement the HTTP server

Create `packages/sync-server/src/index.ts`:

Use Hono. Four endpoints:

#### `POST /sync/push`

**Request body**: `{ source: string, events: SerializedEvent[] }`

Where `SerializedEvent` is:
```ts
{
  id: string           // event ID
  aggregateID: string  // session ID
  seq: number          // per-aggregate sequence
  type: string         // versioned event type
  data: Record<string, unknown>  // event payload
}
```

**Logic**:
1. Validate request body with Zod
2. For each event:
   a. Check if `event.id` already exists (dedup — skip if so)
   b. Validate sequence: `event.seq` should be `last_known_seq + 1` for that aggregate
   c. If sequence mismatch: reject the entire batch with error details
   d. Insert into `sync_event` table
3. Return `{ accepted: number, cursor: number }` where cursor is the highest autoincrement value

**Important**: Wrap the batch in a transaction. All-or-nothing.

#### `GET /sync/pull`

**Query params**: `cursor` (number) — the last cursor the spoke received

**Logic**:
1. `SELECT * FROM sync_event WHERE cursor > :cursor ORDER BY cursor ASC`
2. Return `{ events: SerializedEvent[], cursor: number }` where cursor is the max cursor in the result (or the input cursor if no results)

**Pagination**: Limit to 1000 events per pull. Include a `hasMore: boolean` flag.

#### `GET /sync/sessions`

**Logic**:
1. `SELECT DISTINCT aggregate_id, MAX(seq) as latest_seq, COUNT(*) as event_count FROM sync_event GROUP BY aggregate_id`
2. Return the list — useful for diagnostics and future session browsing

#### `GET /sync/health`

Return `{ ok: true, version: "0.1.0", events: <count>, sessions: <count> }`.

### Step 4: Add authentication

Use the same basic auth as existing opencode serve:
- Username: `opencode`
- Password: from `OPENCODE_SERVER_PASSWORD` env var

Read from env vars at startup. Use Hono's `basicAuth` middleware — same pattern as `packages/opencode/src/server/server.ts`.

### Step 5: Add CORS

Allow requests from any origin (the sync client is a server-side Bun process, not a browser, but keep it open for future web UI).

### Step 6: Test locally

Before deploying to beksinski, test locally:

1. Start the sync server on localhost
2. Use `curl` or a test script to:
   - Push 3 events for aggregate "session-1" (seq 0, 1, 2)
   - Pull them back with cursor 0
   - Verify the returned events match
   - Try pushing a duplicate (should be deduped)
   - Try pushing with wrong sequence (should be rejected)
3. Verify SQLite DB has correct data

Write a test script at `packages/sync-server/test/smoke.ts` that does this automatically.

### Step 7: Write deploy script for beksinski

Create `packages/sync-server/deploy.sh`:

```bash
#!/bin/bash
# Deploy sync server to beksinski
set -euo pipefail

HOST="silo@142.93.94.124"
REMOTE_DIR="/home/silo/sync-server"

# Build
bun build src/index.ts --outfile dist/server.js --target bun

# Copy
rsync -avz dist/ "$HOST:$REMOTE_DIR/"
rsync -avz package.json "$HOST:$REMOTE_DIR/"

# Install deps + restart service
ssh "$HOST" "cd $REMOTE_DIR && bun install --production && sudo systemctl restart opencode-sync"
```

Create systemd unit file `packages/sync-server/opencode-sync.service`:

```ini
[Unit]
Description=OpenCode Sync Server
After=network.target

[Service]
Type=simple
User=silo
WorkingDirectory=/home/silo/sync-server
ExecStart=/home/silo/.bun/bin/bun run dist/server.js
Restart=always
RestartSec=5
Environment=OPENCODE_SERVER_PASSWORD=91+eVoNg9CLylRgKmYcDUQ0P3aIfrIr3AvtkWXtpGm4=
Environment=OPENCODE_SERVER_USERNAME=opencode
Environment=SYNC_PORT=3001
Environment=SYNC_DB_PATH=/home/silo/sync-server/data/sync.db

[Install]
WantedBy=multi-user.target
```

### Step 8: Deploy and verify

1. SSH to beksinski: `ssh silo@142.93.94.124`
2. Run deploy script
3. Install systemd service
4. Start service, check logs
5. Test from pyrrhus: `curl -u opencode:<password> https://opencode.brokentooth.io:3001/sync/health`

**Note**: May need to configure nginx/caddy reverse proxy on beksinski if using HTTPS. Check what's currently serving opencode.brokentooth.io and add a route for the sync server.

---

## Key Files to Read

| File | Why |
|---|---|
| `packages/opencode/src/server/server.ts` | Reference for Hono setup, auth middleware, CORS patterns |
| `packages/opencode/src/sync/index.ts` | Event shape (SerializedEvent type), sequence logic |
| `packages/opencode/src/sync/event.sql.ts` | Event table schema (reference for sync_event schema) |
| `packages/opencode/src/storage/db.ts` | SQLite setup patterns (WAL, PRAGMAs) |
| Phase 1 output | List of all event types that will be synced |

---

## Style Rules

- Single-word variable names: `evt`, `seq`, `agg`, `src`, `cur`
- Snake_case for Drizzle columns
- No destructuring — use dot notation
- `const` over `let`
- Early returns, no `else`
- Keep it minimal — this server should be < 300 lines total

---

## Definition of Done

- [ ] `packages/sync-server/` exists with working Bun + Hono server
- [ ] SQLite DB with `sync_event` and `sync_cursor` tables
- [ ] `POST /sync/push` accepts events, validates sequences, deduplicates
- [ ] `GET /sync/pull?cursor=N` returns events after cursor with pagination
- [ ] `GET /sync/sessions` lists known aggregates
- [ ] `GET /sync/health` returns status
- [ ] Basic auth enabled
- [ ] Smoke test passes locally
- [ ] Deploy script + systemd service file written
- [ ] Deployed and running on beksinski
- [ ] Reachable from pyrrhus via HTTPS
- [ ] Update status in `docs/sync/COLD_BOOT.md`

---

## Handoff to Phase 3

Phase 3 needs:
- The sync server URL (likely `https://opencode.brokentooth.io:3001/sync` or a subpath)
- Confirmation of the exact request/response shapes for push and pull
- Any auth headers required
- The sync server's event ID dedup behavior
