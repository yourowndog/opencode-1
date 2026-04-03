# Session Sync — Cold Boot Index

> Drop the relevant phase document into a fresh agent session to continue work.
> Read `SYNC_PLAN.md` first for the full architecture overview.

## Phase Documents

| Phase | File | Status | Summary |
|---|---|---|---|
| 1 | `PHASE_1_EVENT_AUDIT.md` | NOT STARTED | Audit existing SyncEvent usage, enable flag, fill event coverage gaps |
| 2 | `PHASE_2_SYNC_SERVER.md` | NOT STARTED | Build dumb sync server for beksinski (Bun + Hono + SQLite) |
| 3 | `PHASE_3_SYNC_CLIENT.md` | NOT STARTED | Build sync client in opencode-fork (push/pull + lifecycle hooks) |
| 4 | `PHASE_4_INTEGRATION.md` | NOT STARTED | Cross-machine testing (pyrrhus ↔ titan ↔ beksinski) |
| 5 | `PHASE_5_POLISH.md` | NOT STARTED | TUI sync indicator, CLI command, conflict reporting, phone support |

## Dependency Chain

```
Phase 1 (event audit) → Phase 2 (sync server) → Phase 3 (sync client) → Phase 4 (testing) → Phase 5 (polish)
         ↑                        ↑
   Can start immediately    Can start in parallel with late Phase 1 work
```

## Quick Ecosystem Reference

| Host | Role | IP | Access |
|---|---|---|---|
| pyrrhus | Laptop (T480) | 10.0.0.2 | SSH key, user sam |
| titan | Tower (RTX3090) | 10.0.0.1 | SSH key, user sam |
| beksinski | VPS (sync hub) | 142.93.94.124 | SSH key, user silo |
| icarion | Phone (S25 Ultra) | via ADB | Broken, plan for future |

**Repo**: `/home/sam/projects/opencode-fork/` — fork of sst/opencode, branch `dev`
**Plugin**: `/home/sam/projects/omo-sams-squad/` — custom agents + model routing
**Cluster specs**: `~/cluster-specs/`
