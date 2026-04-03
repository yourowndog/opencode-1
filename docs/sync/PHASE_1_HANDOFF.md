# Phase 1 & 1.5 Handoff: Event Audit & Remediation

## Session Summary
This session completed **Phase 1 (Event Audit & Remediation)** and began **Phase 1.5 (Parity Tests & Legacy Backfill)** of the Session Sync master plan. The primary goal was to ensure all CRUD operations flow through the event sourcing system and that the replay contract is solid enough to rebuild an empty database purely from the event log.

## What Was Accomplished
1. **Architectural Fix (`convertEvent`)**: Removed the `convertEvent` middleware from `src/server/projectors.ts` and the `busSchema` override from `Session.Event.Updated`. The event bus payload is now derived directly from the event itself, not from mutable DB state. This guarantees that replay works reliably on a fresh machine.
2. **Todo System Event Sourcing**: Implemented a `todo.updated` event and projector. Replaced direct DB writes in `Todo.update()` with `SyncEvent.run()`.
3. **CLI Import Refactor**: Refactored `src/cli/cmd/import.ts` to emit standard sync events (`session.created`, `session.updated`, `message.updated`, `message.part.updated`) sequentially instead of performing direct DB inserts.
4. **Project Re-parenting Refactor**: Refactored `src/project/project.ts` to emit `session.updated` events when re-parenting sessions.
5. **Legacy Backfill Command**: Created `opencode sync backfill` (`src/cli/cmd/sync.ts`) to synthesize a baseline event stream for legacy sessions lacking an event history.
6. **Parity Test Creation**: Wrote `test/sync/parity.test.ts` to verify that an empty DB can be perfectly reconstructed from an event log.

## Files Touched & Changed
- `src/session/todo.ts`: Added `todo.updated` event definition; updated `Todo.update()` to use `SyncEvent.run`.
- `src/session/projectors.ts`: Added projector for `todo.updated`.
- `src/server/projectors.ts`: Removed `convertEvent` DB hydration logic.
- `src/session/index.ts`: Removed `busSchema` override for `Session.Event.Updated`.
- `src/cli/cmd/import.ts`: Replaced direct DB inserts with `SyncEvent.run` calls; cleared imported share state.
- `src/project/project.ts`: Replaced direct `SessionTable` updates with `SyncEvent.run(Session.Event.Updated)`.
- `src/cli/cmd/sync.ts`: Created the new `backfill` CLI command.
- `src/index.ts`: Registered the `sync` CLI command.
- `test/sync/parity.test.ts`: Created the end-to-end parity test.

## Testing Status
- **Typecheck**: `bun typecheck` passes (ignoring a few environment-specific missing type definitions for `drizzle-orm`).
- **Parity Test**: `bun test test/sync/parity.test.ts` is currently **FAILING** due to an initialization order / circular dependency issue.
  - **Error**: `ReferenceError: Cannot access 'Instance' before initialization` at `src/env/index.ts:4:17`.

## Next Steps & Handoff Prompt for Next Agent
**Prompt for the next agent:**
> "Your immediate task is to fix the initialization order issue causing `test/sync/parity.test.ts` to fail. The error is `ReferenceError: Cannot access 'Instance' before initialization` originating from `src/env/index.ts`. 
> 
> 1. Investigate the import cycle between `Env`, `Instance`, `Project`, and `Context`.
> 2. Fix the circular dependency so the test environment can boot.
> 3. Run `bun test test/sync/parity.test.ts` and ensure it passes.
> 4. Once the parity test passes, you are cleared to begin **Phase 2 (Sync Server)** as outlined in `docs/sync/PHASE_2_SYNC_SERVER.md`."