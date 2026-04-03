# Phase 5: Polish

> **Goal**: Add user-facing sync features — TUI status indicator, CLI command, conflict UX, phone support prep.
>
> **Depends on**: Phase 4 (integration tests passing)
> **Estimated sessions**: 2-3
> **Next**: Done (maintenance mode)

---

## Context

By this phase, sync works end-to-end across machines. This phase adds the UX layer so Sam can see sync status and manually trigger sync when needed.

---

## Tasks

### Task 1: TUI Sync Status Indicator

Add a visual indicator to the opencode TUI showing sync state.

**Location**: Find the TUI status bar or header component. The TUI is built with Ink (React for terminals) — look in `packages/opencode/src/tui/`.

**States to show**:
- `SYNCED` (green) — all events pushed, last pull recent
- `PENDING ↑3` (yellow) — 3 events waiting to push
- `OFFLINE` (gray) — sync server unreachable
- `PULLING...` / `PUSHING...` (blue) — sync in progress
- `CONFLICT` (red) — sequence error on last push

**Implementation**:
1. Expose `SyncRemote.status()` (built in Phase 3) to the TUI layer
2. Add a small component in the status bar area
3. Poll status every 30 seconds or subscribe to sync state changes

### Task 2: CLI Sync Command

Add `opencode sync` subcommand for manual control:

```
opencode sync status   — show sync state (pending events, last sync time, server health)
opencode sync push     — manually push all pending events
opencode sync pull     — manually pull from server
opencode sync reset    — clear sync state (re-sync from scratch)
```

**Location**: Add to `packages/opencode/src/cli/cmd/` following the pattern of `session.ts`.

### Task 3: Conflict Reporting & Resolution

When a push fails due to sequence mismatch:
1. Log a clear error message with the conflicting aggregate ID and expected vs actual seq
2. Suggest resolution: "Run `opencode sync pull` to fetch remote changes, then retry push"
3. Consider auto-resolution: pull → re-sequence local events → retry push

**Edge case**: If two machines both add messages to the same session, the events have different IDs but the same aggregate. After pulling the other machine's events, the local un-pushed events need their sequence numbers updated to follow the new head. This requires careful handling in `SyncRemote.push()`.

### Task 4: Event Pruning

As events accumulate, the sync server DB grows. Options:
1. **Snapshot-based pruning**: After all spokes have pulled past a certain cursor, those events can be deleted
2. **Time-based pruning**: Delete events older than N days
3. **No pruning**: Keep everything (simplest, storage is cheap)

Recommend starting with option 3 and adding pruning later if storage becomes an issue on beksinski.

### Task 5: Phone Support Prep (icarion)

Currently blocked by the SELinux EACCES bug in `opencode attach`. When this is fixed:
1. Build opencode for Android/Termux (or use the phone as an attach client to a sync-aware server)
2. Add icarion-specific sync config
3. Test phone ↔ beksinski sync

This task is documentation + architecture prep only — implementation waits for the phone fix.

### Task 6: Sync Dashboard (Optional)

A simple web page on beksinski showing:
- Connected spokes and their last sync time
- Session list with event counts
- Sync server health metrics

Could be a static HTML page served by the sync server, or a separate endpoint returning JSON for a future web UI.

---

## Definition of Done

- [ ] TUI shows sync status indicator
- [ ] `opencode sync` CLI command works (status, push, pull, reset)
- [ ] Conflict errors are clear and actionable
- [ ] Phone support documented (architecture + config) even if not yet testable
- [ ] Update status in `docs/sync/COLD_BOOT.md`
- [ ] Update `SESSION_CONTEXT.md` todo list to mark sync as complete

---

## Maintenance Notes

After Phase 5, sync is in maintenance mode. Ongoing concerns:
- **Upstream merges**: When pulling from sst/opencode upstream, watch for changes to the sync module, session schema, or server routes that could break our sync additions
- **New event types**: When opencode adds new features (e.g., new table), ensure they emit events
- **Performance**: Monitor sync server memory/disk on beksinski
- **Security**: The basic auth password is in plaintext in opencode.json — consider env var support
