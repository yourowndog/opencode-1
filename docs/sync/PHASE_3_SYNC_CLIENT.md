# Phase 3: Sync Client

> **Goal**: Build the sync client inside opencode-fork that pushes events to and pulls events from the sync server. Wire it into session lifecycle (close/switch/start).
>
> **Depends on**: Phase 1 (events emitting), Phase 2 (sync server running on beksinski)
> **Estimated sessions**: 2-3
> **Next**: Phase 4 (Integration Testing)

---

## Context

Each spoke (pyrrhus, titan, icarion) runs OpenCode with a local SQLite DB. The sync client lives inside the opencode codebase and handles:
- **Push**: On session close/switch, collect un-synced events from local `event` table → POST to beksinski
- **Pull**: On session open/app start, GET new events from beksinski → replay locally via `SyncEvent.replay()`

Design constraints:
- **Offline-first**: If beksinski is unreachable, operations proceed locally. Sync catches up when reconnected.
- **All sessions, always**: No opt-in. Every event gets synced.
- **On session close/switch**: Not real-time per-message.

---

## Step-by-Step Instructions

### Step 1: Add sync config to opencode.json schema

Edit `packages/opencode/src/config/config.ts` to add a `sync` section:

```ts
sync: z.object({
  enabled: z.boolean().default(false),
  server: z.string().url(),           // e.g. "https://opencode.brokentooth.io:3001"
  auth: z.object({
    username: z.string(),
    password: z.string(),
  }).optional(),
  source: z.string(),                 // machine identity: "pyrrhus", "titan", etc.
}).optional()
```

Verify this merges correctly in the config hierarchy (system → global → project).

### Step 2: Add local sync state tracking

Create a new schema file `packages/opencode/src/sync/state.sql.ts`:

```ts
import { sqliteTable, text } from "drizzle-orm/sqlite-core"

export const SyncStateTable = sqliteTable("sync_state", {
  key: text().primaryKey(),
  value: text().notNull(),
})
```

Keys to track:
- `last_push_cursor`: The highest sync_event.cursor we've successfully pushed (or the highest local event ID we've pushed)
- `last_pull_cursor`: The highest cursor we've received from the sync server
- `source_id`: This machine's identity

Generate a Drizzle migration: `bun drizzle-kit generate` from `packages/opencode/`.

### Step 3: Implement the sync client module

Create `packages/opencode/src/sync/remote.ts`:

#### Client initialization
```ts
export namespace SyncRemote {
  // Read config, set up HTTP client with auth headers
  // Use fetch() (available in Bun) — no extra deps needed
}
```

#### Push function
```ts
export async function push() {
  // 1. Read sync config — bail if not enabled
  // 2. Get all events from local EventTable that haven't been pushed
  //    Strategy: track last pushed event ID in SyncStateTable
  //    Query: SELECT * FROM event WHERE id > last_pushed_id ORDER BY id ASC
  // 3. If no events, return early
  // 4. Batch POST to sync server: POST /sync/push
  //    Body: { source: config.source, events: [...] }
  // 5. On success: update last_pushed_id in SyncStateTable
  // 6. On network error: log warning, don't crash — offline-first
  // 7. On sequence error from server: log error with details for debugging
}
```

**Important**: The local `event` table uses ascending event IDs (see `EventID.ascending()` in sync/index.ts). Use the ID ordering to determine which events are new.

#### Pull function
```ts
export async function pull() {
  // 1. Read sync config — bail if not enabled
  // 2. Read last_pull_cursor from SyncStateTable (default: 0)
  // 3. GET /sync/pull?cursor={last_pull_cursor}
  // 4. For each returned event:
  //    a. Skip if event.source === config.source (don't replay our own events)
  //    b. Call SyncEvent.replay(event) — this validates sequence and runs projector
  // 5. Update last_pull_cursor in SyncStateTable
  // 6. If response.hasMore: loop and pull again
  // 7. On network error: log warning, don't crash
}
```

**Critical**: Skip events that originated from this machine (`event.source === config.source`). The local DB already has these from when they were created.

#### Status function
```ts
export async function status() {
  // Return { pendingPush: number, lastPull: Date, connected: boolean }
  // Useful for TUI indicator in Phase 5
}
```

### Step 4: Wire into session lifecycle

Find where sessions transition and add push/pull calls. Key integration points:

#### On app start (pull)
In `packages/opencode/src/cli/cmd/run.ts` or wherever the main entry point initializes:
```ts
// After DB init, before TUI render
if (sync.enabled) await SyncRemote.pull()
```

#### On session close (push)
Find where sessions are "closed" — this might be:
- TUI exit handler
- Session switch logic
- `Session.archive()` or similar

```ts
// Before cleanup
if (sync.enabled) await SyncRemote.push()
```

#### On session switch (push old, pull new)
When switching from session A to session B:
```ts
if (sync.enabled) {
  await SyncRemote.push()   // push events from session A
  await SyncRemote.pull()   // pull any new events (including for session B)
}
```

#### Via plugin hook (alternative)
The omo-sams-squad plugin already listens to `session.status` events. Could trigger sync from the plugin instead of hardcoding in opencode:

```ts
// In plugin event hook
if (event.type === "session.status" && event.data.status === "idle") {
  await SyncRemote.push()
}
```

**Decision for implementer**: Hardcode in opencode core vs plugin hook. Core is more reliable; plugin is more modular. Recommend core for push/pull, with a bus event emitted so plugins can react.

### Step 5: Handle the OPENCODE_EXPERIMENTAL_WORKSPACES flag

The event system only persists to the `event` table when this flag is true. For sync to work, this flag MUST be enabled. Options:
1. **Auto-enable when sync is configured** — if `config.sync.enabled`, force the flag on
2. **Require manual flag** — document that users must set it
3. **Remove the gate entirely** — always persist events

Recommend option 1: auto-enable when sync is configured.

### Step 6: Test locally (single machine, simulated sync)

Before cross-machine testing:
1. Enable sync config pointing to a locally running sync server
2. Create a session, send messages
3. Call `SyncRemote.push()` — verify events land on sync server
4. Clear local DB tables (session, message, part) but keep sync_state
5. Call `SyncRemote.pull()` — verify sessions/messages are reconstructed via replay
6. Compare reconstructed data against what was cleared

---

## Key Files

| File | Purpose |
|---|---|
| `packages/opencode/src/sync/index.ts` | SyncEvent.run(), replay(), SerializedEvent type |
| `packages/opencode/src/sync/event.sql.ts` | EventTable, EventSequenceTable |
| `packages/opencode/src/config/config.ts` | Config schema — add sync section here |
| `packages/opencode/src/cli/cmd/run.ts` | Main CLI entry — hook pull on start |
| `packages/opencode/src/cli/cmd/serve.ts` | Server CLI entry — may also need hooks |
| `packages/opencode/src/server/projectors.ts` | Projectors init — ensure they're loaded before pull |
| `packages/opencode/src/flag/flag.ts` | OPENCODE_EXPERIMENTAL_WORKSPACES flag |
| `packages/opencode/src/bus/index.ts` | Event bus — for emitting sync status events |

---

## Style Rules

- Single-word names: `cfg`, `evt`, `cur`, `src`
- Inline values used once — no intermediate variables
- `const` over `let`, early returns, no `else`
- Use `fetch()` for HTTP (Bun built-in) — no axios/got
- Errors: log and continue, don't crash (offline-first)
- Snake_case for any new Drizzle columns

---

## Definition of Done

- [ ] Sync config section added to opencode.json schema
- [ ] `sync_state` table created with Drizzle migration
- [ ] `SyncRemote.push()` collects un-synced events and POSTs to server
- [ ] `SyncRemote.pull()` fetches new events, skips own source, replays them
- [ ] Push wired to session close/switch
- [ ] Pull wired to app start
- [ ] `OPENCODE_EXPERIMENTAL_WORKSPACES` auto-enabled when sync is configured
- [ ] Local round-trip test passes (push → clear DB → pull → data reconstructed)
- [ ] `bun typecheck` passes from `packages/opencode/`
- [ ] Update status in `docs/sync/COLD_BOOT.md`

---

## Handoff to Phase 4

Phase 4 needs:
- The sync config shape and how to set it per machine
- Confirmation that push/pull work in isolation
- Any known limitations (event size, missing projectors, etc.)
- The exact lifecycle hooks (where push/pull are triggered)
