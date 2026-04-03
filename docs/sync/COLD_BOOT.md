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

## Beksinski Access Reference

beksinski is the central sync hub VPS. Every phase that touches the network needs this info.

```
Host:     142.93.94.124
User:     silo
SSH:      ssh silo@142.93.94.124  (key-based, no password)
Home:     /home/silo
```

**Currently running**: `opencode serve` v1.3.13
```
URL:      https://opencode.brokentooth.io
Auth:     Basic — username: opencode
          password: 91+eVoNg9CLylRgKmYcDUQ0P3aIfrIr3AvtkWXtpGm4=
```

**Sync server (to be deployed in Phase 2)**:
```
Port:     3001 (planned)
Path:     /home/silo/sync-server/
Service:  opencode-sync.service (systemd)
DB:       /home/silo/sync-server/data/sync.db
```

**Quick test from any machine**:
```bash
# SSH access
ssh silo@142.93.94.124 "uname -a"

# Current opencode server
curl -u opencode:'91+eVoNg9CLylRgKmYcDUQ0P3aIfrIr3AvtkWXtpGm4=' https://opencode.brokentooth.io/global/health

# Sync server (after Phase 2 deploy)
curl -u opencode:'91+eVoNg9CLylRgKmYcDUQ0P3aIfrIr3AvtkWXtpGm4=' https://opencode.brokentooth.io:3001/sync/health
```
