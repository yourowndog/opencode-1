# Sync System (Beksinski)

[CONFIRMED]
The Beksinski architecture is a hub-and-spoke model intended to replicate local SQLite sessions to a centralized cloud.

## Design
- **Beksinski (VPS)**: `142.93.94.124`. Serves as a dumb sync server, receiving JSON serialized events directly via REST API.
- **Client (opencode-fork)**: Implements `SyncClient` inside `packages/opencode/src/sync/remote.ts`. Reads local DB cursors on start, pulls events via HTTP, and pushes delta events on session-close.

## The Sync State
[CONFIRMED]
- The system depends on `sync_state` to track the `last_push_cursor` and `last_pull_cursor`.
- If an out-of-order event occurs, the system replays events monotonically per ID.

## CURRENTLY OFFLINE
[CONFIRMED]
The synchronization service configurations sit disabled. Due to configuration backups (`.bak` files replacing proper `.jsonc` pointers) and potentially broken auto-flags, the system defaults to Offline-First execution without a network hand-off.
