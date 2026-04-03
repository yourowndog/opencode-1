# OpenCode Session Sync — Master Plan

> **Status**: DRAFT v1 — 2026-04-02
> **Goal**: Every OpenCode session from any machine syncs to beksinski (VPS) as central truth. `/session` on any device shows all sessions; resume anywhere.

---

## 1. Design Decisions (Locked)

| Decision | Choice | Rationale |
|---|---|---|
| Tower identity | titan (10.0.0.1, i7-8700K/RTX3090) | Confirmed by Sam |
| Sync scope | Internet (anywhere) | beksinski is the public hub; coffee-shop laptop must sync |
| Auto vs opt-in | All sessions, always | No manual tagging |
| Offline mode | Offline-first | Local SQLite always works; sync when connected |
| Sync frequency | On session close/switch | Not real-time per-message; batched on transitions |
| Phone | Plan for icarion | Currently broken, but architecture must support it |
| beksinski role | Dumb sync server | Stores/serves events only. No AI sessions, no fork deployment |

---

## 2. Architecture: Hub-and-Spoke Event Sync

```
                    ┌─────────────────────┐
                    │   beksinski (VPS)    │
                    │  142.93.94.124       │
                    │                     │
                    │  Sync Server (Bun)  │
                    │  - SQLite event DB  │
                    │  - REST API         │
                    │  - Basic Auth       │
                    └───┬────┬────┬───────┘
                        │    │    │
              ┌─────────┘    │    └─────────┐
              │              │              │
        ┌─────┴─────┐ ┌─────┴─────┐ ┌──────┴────┐
        │  pyrrhus   │ │   titan   │ │  icarion  │
        │  (laptop)  │ │  (tower)  │ │  (phone)  │
        │  local DB  │ │  local DB │ │  local DB │
        └────────────┘ └───────────┘ └───────────┘
              Spokes: full OpenCode with local SQLite
```

### How It Works

1. **Each spoke** runs OpenCode normally with its local SQLite DB
2. **On session close/switch**, the spoke pushes un-synced events to beksinski
3. **On session open/app start**, the spoke pulls new events from beksinski and replays them locally
4. **beksinski** is a dumb event store — receives events via REST, stores in SQLite, serves them back

### Why Events (Not Row Sync)

OpenCode already has an event sourcing module at `packages/opencode/src/sync/`:
- `SyncEvent.define()` — register event types with Zod schemas + versioning
- `SyncEvent.run()` — execute event: generate ID, increment per-aggregate sequence, run projector, persist
- `SyncEvent.replay()` — replay serialized event with strict sequence validation
- Events are persisted to `event` and `event_sequence` tables (gated by `Flag.OPENCODE_EXPERIMENTAL_WORKSPACES`)

This is the foundation. We extend it rather than building from scratch.

---

## 3. Components to Build

### 3A. Sync Server (beksinski) — `packages/sync-server/`

A standalone Bun HTTP server. Minimal: receives events, stores them, serves them.

**Endpoints:**

```
POST   /sync/push          — Accept batch of events from a spoke
GET    /sync/pull           — Return events after a given cursor
GET    /sync/sessions       — List all known session aggregates
GET    /sync/health         — Health check
```

**Database:** Single SQLite file with two tables:

```sql
-- Global monotonic cursor for ordering across all aggregates
CREATE TABLE sync_event (
  cursor    INTEGER PRIMARY KEY AUTOINCREMENT,
  id        TEXT NOT NULL UNIQUE,          -- event ID from spoke
  aggregate_id TEXT NOT NULL,
  seq       INTEGER NOT NULL,
  type      TEXT NOT NULL,
  data      TEXT NOT NULL,                 -- JSON
  source    TEXT NOT NULL,                 -- spoke hostname
  time_received INTEGER NOT NULL           -- server timestamp
);

CREATE TABLE sync_cursor (
  source    TEXT PRIMARY KEY,              -- spoke hostname
  cursor    INTEGER NOT NULL DEFAULT 0     -- last cursor this spoke has pulled
);
```

**Auth:** Basic auth (same creds as current opencode serve: `opencode` / `91+eVoNg9CLylRgKmYcDUQ0P3aIfrIr3AvtkWXtpGm4=`)

**Push logic:**
1. Receive batch of `SerializedEvent[]` from spoke
2. For each event, validate: `event.seq === last_known_seq + 1` for that aggregate
3. Insert into `sync_event` with auto-incrementing cursor
4. Return `{ accepted: number, cursor: number }` — the new global cursor

**Pull logic:**
1. Spoke sends `{ cursor: number }` (last cursor it received)
2. Server returns all events with `cursor > spoke_cursor`, ordered by cursor
3. Response includes the new cursor high-water mark

### 3B. Sync Client (in opencode-fork) — `packages/opencode/src/sync/remote.ts`

Hooks into the existing sync module. Runs on each spoke.

**Push (on session close/switch):**
1. Query local `event` table for un-pushed events (events where `time_created > last_push_time`)
2. Batch POST to beksinski `/sync/push`
3. On success, update local `last_push_cursor` in a new `sync_state` table

**Pull (on session open / app start / periodic):**
1. Read local `last_pull_cursor` from `sync_state`
2. GET beksinski `/sync/pull?cursor={last_pull_cursor}`
3. For each returned event, call `SyncEvent.replay(event)`
4. Update `last_pull_cursor`

**New local table:**
```sql
CREATE TABLE sync_state (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- Keys: 'last_push_cursor', 'last_pull_cursor', 'source_id'
```

### 3C. Event Registration for All Session Operations

Currently, the event system is gated by `Flag.OPENCODE_EXPERIMENTAL_WORKSPACES`. We need events for:
- `session.created` — new session
- `session.updated` — title change, metadata updates
- `session.deleted` — session deletion
- `message.created` — new message in session
- `message.updated` — message content update (streaming completion)
- `part.created` — new part in message
- `part.updated` — part content update
- `todo.created` / `todo.updated` / `todo.deleted`

**Check**: Which of these already have SyncEvent definitions? Need to audit `packages/opencode/src/` for existing `SyncEvent.define()` calls.

### 3D. Trigger Points (Session Close/Switch)

Where to hook the push/pull cycle:
- **Session close**: When user exits a session → push events for that session
- **Session switch**: When user changes to a different session → push old, pull new
- **App start**: Pull all since last cursor
- **Plugin hook**: `event('session.status')` in omo-sams-squad already fires on session transitions

---

## 4. Implementation Phases

### Phase 1: Foundation (No Network Yet)
- [ ] Audit existing `SyncEvent.define()` usage — find which events are already defined
- [ ] Ensure `OPENCODE_EXPERIMENTAL_WORKSPACES` flag enables event persistence
- [ ] Verify all CRUD operations on sessions/messages/parts go through `SyncEvent.run()`
- [ ] If not, add missing event definitions and projectors

### Phase 2: Sync Server
- [ ] Create `packages/sync-server/` with Bun + Hono
- [ ] Implement SQLite storage with `sync_event` and `sync_cursor` tables
- [ ] Implement `/sync/push`, `/sync/pull`, `/sync/sessions`, `/sync/health`
- [ ] Add basic auth middleware
- [ ] Write deploy script for beksinski (systemd service)
- [ ] Test locally with two SQLite DBs

### Phase 3: Sync Client
- [ ] Add `sync_state` table to opencode schema
- [ ] Implement `SyncClient` in `packages/opencode/src/sync/remote.ts`
- [ ] Add push logic: collect un-synced events → POST to server
- [ ] Add pull logic: GET from server → replay locally
- [ ] Hook into session lifecycle (close/switch/start triggers)
- [ ] Add sync config to `opencode.json` (server URL, auth, enabled flag)

### Phase 4: Integration & Testing
- [ ] Test: Create session on pyrrhus → close → verify appears on titan
- [ ] Test: Resume session on titan → close → verify updates on pyrrhus
- [ ] Test: Offline work on pyrrhus → reconnect → verify sync catches up
- [ ] Test: Concurrent access (should reject with sequence error, not corrupt)
- [ ] Test: Large sessions (many messages/parts)

### Phase 5: Polish
- [ ] TUI indicator showing sync status (synced/pending/offline)
- [ ] `opencode sync` CLI command for manual push/pull
- [ ] Conflict reporting (when sequence validation fails)
- [ ] Phone support (when icarion's opencode attach is fixed)

---

## 5. Open Questions

1. **Event coverage**: How many session/message operations already go through `SyncEvent.run()` vs direct DB writes? This determines how much plumbing Phase 1 requires.

2. **Event size**: Messages with large tool outputs (file contents, diffs) could be megabytes. Should we compress event data, or set size limits?

3. **Session ownership**: If two machines edit the same session simultaneously, `replay()` will fail with sequence mismatch. Is "last close wins" acceptable? Or do we need locking?

4. **Pruning**: Old events accumulate. Should the sync server prune events older than N days? Or keep everything?

5. **Existing server on beksinski**: Currently runs `opencode serve` on port accessible at `opencode.brokentooth.io`. Should the sync server run alongside it on a different port, or replace it?

---

## 6. Key Files Reference

| File | Purpose |
|---|---|
| `packages/opencode/src/sync/index.ts` | Core event sourcing: define, run, replay, process |
| `packages/opencode/src/sync/event.sql.ts` | Event + EventSequence table schemas |
| `packages/opencode/src/session/session.sql.ts` | Session, Message, Part, Todo table schemas |
| `packages/opencode/src/server/server.ts` | Hono server setup, auth, middleware |
| `packages/opencode/src/server/routes/session.ts` | Session REST endpoints |
| `packages/opencode/src/flag/flag.ts` | Feature flags including OPENCODE_EXPERIMENTAL_WORKSPACES |
| `packages/opencode/src/server/projectors.ts` | Where SyncEvent projectors are initialized |

---

## 7. Config Shape (Proposed)

```jsonc
// opencode.json
{
  "sync": {
    "enabled": true,
    "server": "https://opencode.brokentooth.io",
    "auth": {
      "username": "opencode",
      "password": "91+eVoNg9CLylRgKmYcDUQ0P3aIfrIr3AvtkWXtpGm4="
    },
    "source": "pyrrhus",      // this machine's identity
    "pullOnStart": true,       // pull events when opencode starts
    "pushOnClose": true        // push events when session closes
  }
}
```
