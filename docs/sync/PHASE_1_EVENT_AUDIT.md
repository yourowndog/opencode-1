# Phase 1: Event Coverage Audit

> **Goal**: Ensure every session/message/part CRUD operation flows through the event sourcing system so we have a complete event log to sync.
>
> **Depends on**: Nothing — start here.
> **Estimated sessions**: 1-2
> **Next**: Phase 2 (Sync Server)

---

## Context

OpenCode has an event sourcing module at `packages/opencode/src/sync/` that can record all state changes as events and replay them. This is the foundation for sync — if every mutation is an event, we can ship those events to other machines and replay them to reconstruct state.

**The problem**: We don't know how much of this is wired up. Event persistence is gated behind a feature flag, and it's unclear which operations actually emit events vs writing directly to the DB.

---

## Step-by-Step Instructions

### Step 1: Find all existing SyncEvent definitions

```bash
# From repo root
cd /home/sam/projects/opencode-fork

# Find all SyncEvent.define() calls — these are the event types that exist
rg "SyncEvent\.define" packages/opencode/src/ --type ts -n

# Find all SyncEvent.run() calls — these are the places events are actually emitted
rg "SyncEvent\.run" packages/opencode/src/ --type ts -n

# Find all SyncEvent.replay() calls — these are consumption points
rg "SyncEvent\.replay" packages/opencode/src/ --type ts -n
```

**Record**: Make a list of every event type defined and every place it's emitted. This is your baseline.

### Step 2: Read the projectors file

```bash
cat packages/opencode/src/server/projectors.ts
```

This file calls `SyncEvent.init({ projectors: [...] })` and registers all the projector functions. Each projector maps an event type to the DB writes it should perform. Document what's here.

### Step 3: Understand the feature flag gate

```bash
rg "OPENCODE_EXPERIMENTAL_WORKSPACES" packages/opencode/src/ --type ts -n
```

In `packages/opencode/src/sync/index.ts`, the `process()` function (line ~120) only inserts into `EventTable` and `EventSequenceTable` when `Flag.OPENCODE_EXPERIMENTAL_WORKSPACES` is true. Check:
- Where is this flag defined? (`packages/opencode/src/flag/flag.ts`)
- How is it set? (environment variable? config?)
- Is it currently enabled on any machine?

### Step 4: Map all session/message/part write operations

We need events for every mutation. Search for direct DB writes that bypass events:

```bash
# Direct inserts/updates to session table
rg "SessionTable" packages/opencode/src/ --type ts -n | grep -E "insert|update|delete"

# Direct inserts/updates to message table
rg "MessageTable" packages/opencode/src/ --type ts -n | grep -E "insert|update|delete"

# Direct inserts/updates to part table
rg "PartTable" packages/opencode/src/ --type ts -n | grep -E "insert|update|delete"

# Direct inserts/updates to todo table
rg "TodoTable" packages/opencode/src/ --type ts -n | grep -E "insert|update|delete"
```

**Compare** these against the SyncEvent.run() calls from Step 1. Any DB write that doesn't go through an event is a gap.

### Step 5: Document the gap analysis

Create a table:

| Operation | Has Event? | Has Projector? | File:Line | Notes |
|---|---|---|---|---|
| session.create | ? | ? | ? | |
| session.update (title) | ? | ? | ? | |
| session.delete | ? | ? | ? | |
| message.create | ? | ? | ? | |
| message.update | ? | ? | ? | |
| part.create | ? | ? | ? | |
| part.update | ? | ? | ? | |
| todo.create | ? | ? | ? | |
| todo.update | ? | ? | ? | |
| todo.delete | ? | ? | ? | |

### Step 6: Fill the gaps (if any)

For each missing event, you need to:

1. **Define the event** — add a `SyncEvent.define()` call, following the pattern of existing definitions:
   ```ts
   export const SessionCreated = SyncEvent.define({
     type: "session.created",
     version: 1,
     aggregate: "id",  // field name in schema that identifies the aggregate
     schema: z.object({
       id: SessionID.zod,
       project_id: z.string(),
       // ... all fields needed to reconstruct this row
     }),
   })
   ```

2. **Write the projector** — a function that takes the event data and writes to the actual table:
   ```ts
   SyncEvent.project(SessionCreated, (db, data) => {
     db.insert(SessionTable).values(data).run()
   })
   ```

3. **Replace the direct write** — change the code that currently does `db.insert(SessionTable).values(...)` to instead call `SyncEvent.run(SessionCreated, data)`.

4. **Register the projector** in `packages/opencode/src/server/projectors.ts`.

### Step 7: Verify event round-trip

After filling gaps:

1. Enable `OPENCODE_EXPERIMENTAL_WORKSPACES` flag
2. Create a test session, send a message
3. Check the `event` table has the expected events:
   ```bash
   # From a bun shell or sqlite3
   sqlite3 ~/.local/share/opencode/opencode.db "SELECT type, aggregate_id, seq FROM event ORDER BY id"
   ```
4. Verify the `event_sequence` table tracks aggregates correctly
5. Test `SyncEvent.replay()` by clearing the main tables and replaying events

---

## Key Files

| File | Read For |
|---|---|
| `packages/opencode/src/sync/index.ts` | Core event sourcing module (define, run, replay, process) |
| `packages/opencode/src/sync/event.sql.ts` | Event + EventSequence table schemas |
| `packages/opencode/src/server/projectors.ts` | Where projectors are registered via SyncEvent.init() |
| `packages/opencode/src/flag/flag.ts` | Feature flag definitions |
| `packages/opencode/src/session/index.ts` | Session CRUD operations — check if they use events |
| `packages/opencode/src/session/session.sql.ts` | Session/Message/Part/Todo table schemas |
| `packages/opencode/src/session/message-v2.ts` | Message part type definitions |

---

## Style Rules (from repo AGENTS.md)

- Single-word variable names preferred (`cfg`, `evt`, `seq`, `agg`)
- Snake_case for Drizzle column names
- No unnecessary destructuring — use dot notation
- `const` over `let`, ternaries over reassignment
- Early returns, no `else`
- Avoid `try/catch`, avoid `any`
- Run `bun typecheck` from `packages/opencode/`, never `tsc` directly
- Tests run from package dirs, not repo root

---

## Definition of Done

- [ ] Complete gap analysis table showing all session/message/part/todo operations and their event coverage
- [ ] All CRUD operations emit events via `SyncEvent.run()`
- [ ] All events have corresponding projectors registered in `projectors.ts`
- [ ] `OPENCODE_EXPERIMENTAL_WORKSPACES` flag behavior documented (how to enable, what it controls)
- [ ] Event round-trip verified: create session → check event table → replay works
- [ ] `bun typecheck` passes from `packages/opencode/`
- [ ] Update this file's status in `COLD_BOOT.md` to COMPLETE

---

## Handoff to Phase 2

When done, update `docs/sync/COLD_BOOT.md` status table. The key output Phase 2 needs:
- Confirmation that all events are being persisted to the `event` table
- The exact list of event types (type strings) that exist
- Any edge cases discovered (large events, high-frequency updates, etc.)
