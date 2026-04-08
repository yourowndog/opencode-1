# Session Model

[CONFIRMED]
A session is the root bounding box for an interaction: it encapsulates messages, model queries, file diffs, and executed commands into a persisted transaction.

## Creation & Retrieval
1. Loaded dynamically based on the current workspace/working directory.
2. If `--continue` or `--session` flags are provided, it is queried from the local `opencode.db` SQLite database using DrizzleORM.
3. Once retrieved, UI reactivity hinges directly on observing the reactive signal connected to this single object representation.

## Storage
- **Local DB**: `~/.local/share/opencode/opencode.db`.
- **Sync mechanism**: Emits `session.created` and `session.updated` events that `SyncEvent.run()` appends to an internal ledger log table (`event` and `event_sequence`).

## Why Sessions Fail Across Machines
[CONFIRMED]
If a user switches machines (e.g., Tower vs Laptop), the session ID is effectively missing from the new machine's local SQLite store. 
Because the Beksinski server synchronization module is explicitly disabled (`opencode.jsonc.bak` and `.opencode.jsonc` mismatch / network disable flag), the distributed event-sourcing system never replicates the ledger. Attempting to fetch a session ID retrieved on another machine results in a `NotFound` or `BusyError`, resulting in the `session()` signal evaluating to null, crashing/blanking out the TUI component tree.
