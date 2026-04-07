# Session Sync — Cold Boot Index

> Drop the relevant phase document into a fresh agent session to continue work.
> Read `SYNC_PLAN.md` first for the full architecture overview.

## Phase Documents

| Phase | File | Status | Summary |
|---|---|---|---|
| 1 | `PHASE_1_EVENT_AUDIT.md` | COMPLETE | Event audit done; parity test passing; all sync events go through SyncEvent.run |
| 2 | `PHASE_2_SYNC_SERVER.md` | COMPLETE | Sync server deployed to beksinski on port 3001 (user-level systemd service) |
| 3 | `PHASE_3_SYNC_CLIENT.md` | COMPLETE | Sync client implemented: config schema, SyncRemote (push/pull/status), bootstrap hooks, auto-flag |
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

**Sync server (deployed, Phase 2 complete)**:
```
Port:     3001 (direct HTTP — no TLS yet, DNS subdomain not configured)
Path:     /home/silo/sync-server/
Service:  ~/.config/systemd/user/opencode-sync.service (user-level systemd)
DB:       /home/silo/sync-server/data/sync.db
Note:     Caddy config updated with sync.opencode.brokentooth.io route but DNS not set
```

**Sync server endpoints**:
```
POST /sync/push   - Push events (batch, with dedup + sequence validation)
GET  /sync/pull   - Pull events since cursor (max 1000, hasMore flag)
GET  /sync/sessions - List known aggregates
GET  /sync/health - Status check
```

**Quick test from any machine**:
```bash
# SSH access
ssh silo@142.93.94.124 "uname -a"

# Current opencode server
curl -u opencode:'91+eVoNg9CLylRgKmYcDUQ0P3aIfrIr3AvtkWXtpGm4=' https://opencode.brokentooth.io/global/health

# Sync server (direct HTTP)
curl -u opencode:'91+eVoNg9CLylRgKmYcDUQ0P3aIfrIr3AvtkWXtpGm4=' http://142.93.94.124:3001/sync/health
```
