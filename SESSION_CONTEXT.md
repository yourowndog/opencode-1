# Session Context — Cold Boot Reference

> **For agents entering this repo cold.** This document captures the full context of the multi-session work that led to this fork being created, what we're building, current system state, and the todo list going forward.

---

## 1. Who and What

**User**: `yourowndog` (Sam) — developer with a cluster of machines, an Android phone (Icarion), and a VPS (beksinski).

**This repo**: `yourowndog/opencode-1` — a fork of `anomalyco/opencode` (itself a fork of `sst/opencode`). The plan is to make substantive changes: better model management, UI enhancements, and tighter integration with the beksinski server deployment.

**The broader ecosystem** (Sam's stack):
- `~/projects/omo-sams-squad` — custom OpenCode plugin (replaces oh-my-opencode-slim). This is the main plugin loaded into OpenCode. It registers custom agents/personas, sets model defaults, and fires a "omo-sams-squad is active" toast on session creation.
- `~/projects/sams-custom-kotlin-mcp` — custom LSP/MCP server binary at `~/.local/bin/sams-custom-kotlin-mcp`. Provides Kotlin LSP features as an MCP tool inside OpenCode.
- `~/projects/soma` — Android app (Kotlin/Compose). This is Sam's AI chat app. It fetches models from OpenRouter + Gemini, has smart model filtering/linting logic, and is the intended mobile client for the beksinski OpenCode server.
- `~/projects/omniboard` — keyboard/input management tooling.

---

## 2. Infrastructure Map

### pyrrhus (dev workstation, this machine)
- Main dev machine Sam works from
- OpenCode runs here locally
- ADB connection to phone (Icarion) goes through here
- Config: `~/.opencode/opencode.json` (symlinked from `~/opencode-config/opencode/opencode.json`)
- Plugin: `omo-sams-squad` loaded via `file:///home/sam/projects/omo-sams-squad`
- Cluster specs at `~/cluster-specs/` (symlinked)

### beksinski (VPS — Ubuntu 25.04)
- **IP**: 142.93.94.124
- **SSH user**: `silo` (no passwordless sudo)
- **Specs**: 1 vCPU, 1.9 GB RAM, 48 GB disk, 8 GB swap
- **Stack**: Node 20.18.1, Caddy v2.10.2, PHP 8.4-FPM, MariaDB 11.4.7
- **OpenCode**: v1.3.13 installed at `/home/silo/.opencode/bin/opencode`
- **OpenCode service**: systemd user service at `~/.config/systemd/user/opencode-serve.service` — **running and active**
- **Auth**: Basic auth. Username defaults to `opencode`, password set via `OPENCODE_SERVER_PASSWORD` env var in service file. Username can be overridden with `OPENCODE_SERVER_USERNAME`.
- **API key / password**: `91+eVoNg9CLylRgKmYcDUQ0P3aIfrIr3AvtkWXtpGm4=`
- **Public URL**: `https://opencode.brokentooth.io` (Caddy reverse proxy, DNS propagated and working)
- **Verified working**: `curl -u "opencode:91+eVoNg9CLylRgKmYcDUQ0P3aIfrIr3AvtkWXtpGm4=" https://opencode.brokentooth.io/session` → 200 OK `[]`
- **Attach command**: `opencode attach https://opencode.brokentooth.io -p 91+eVoNg9CLylRgKmYcDUQ0P3aIfrIr3AvtkWXtpGm4=`

### icarion (Android phone — Samsung)
- **ADB device**: `R5CY33PBGCX` (connects via USB to pyrrhus)
- **ADB forward**: `adb -s R5CY33PBGCX forward tcp:8022 tcp:8022 && ssh -p 8022 localhost`
- **SSH config**: `icarion` host entry works when ADB is forwarded
- **OS**: Android 15, Samsung Knox, kernel 6.6 (seccomp blocks proot execution)
- **Termux**: OpenCode runs via `grun` alias (glibc runner for Android's bionic libc)
- **Status**: `opencode attach` is BROKEN — see Section 4

---

## 3. OpenCode Plugin: omo-sams-squad

**Location**: `~/projects/omo-sams-squad/`  
**Loaded via**: `file:///home/sam/projects/omo-sams-squad` in `~/.opencode/opencode.json`

This replaces the original `oh-my-opencode-slim` plugin. It was built from scratch during this session.

**Key behaviors:**
- Fires `"omo-sams-squad is active"` toast on `session.created` (not on session resume — that's by design)
- Registers custom agents with specific model assignments
- Kills native OpenCode general/explore agents via `agent.general = {disable: true}` and `agent.explore = {disable: true}` in `~/.opencode/opencode.json`

**Model string format rule** (critical — cost Sam debugging time):  
OpenCode requires fully namespaced `provider/model-id` strings. Examples:
- `anthropic/claude-3-7-sonnet-20250219` ✅
- `google/gemini-2.5-pro` ✅
- `claude-opus-4.6` ❌ (bare alias — throws `ProviderModelNotFoundError`)

**Auth plugins loaded**:
- `opencode-claude-auth` → `anthropic/` prefix
- `opencode-gemini-auth` → `google/` prefix
- No OpenAI auth → any `openai/` model will fail

**Build**: `cd ~/projects/omo-sams-squad && bun run build` — currently passing.

---

## 4. Icarion Phone — OpenCode Broken (Known Bug)

**Symptom**: `opencode attach` crashes immediately with `CouldntReadCurrentDirectory`

**Root cause** (confirmed via strace):  
OpenCode startup code calls `getcwd()` (succeeds), then walks upward doing `openat(AT_FDCWD, "/", O_RDONLY|O_DIRECTORY)` to find a project root. Android SELinux returns `EACCES` on this traversal. The error fires before argument parsing — so `--dir` flag can't help even if it existed in the binary.

**Binary situation**:
- Installed: `~/.local/bin/opencode` — v1.3.10 glibc (broken)
- Downloaded to `$TMPDIR`: `opencode-linux-arm64.tar.gz` from v1.3.13 release — extracts to v1.3.11 binary (the v1.3.13 release tag was only a metadata/opentui bump, no new binary was built)
- Both versions have the same bug

**Fixes already applied** (won't fix the crash but are correct cleanup):
- `~/.config/opencode/opencode.json` — removed broken jcodemunch/jdocmunch MCP entries
- `~/.bashrc.d/20-openclaw.sh` — alias simplified to `alias opencode='grun ~/.local/bin/opencode'` (removed proot proxy script that was also broken due to Samsung seccomp blocking proot)

**Path translation note**: When MCP tools on Termux (like jcodemunch if it ever runs) receive paths, they need `/data/data/com.termux/files/home` translated to `/root/home` because jcodemunch runs inside proot Debian where that's the mapping. Currently moot since proot is broken.

**To fix properly**: Either wait for a new binary release that actually includes the `--dir` startup bypass, or build from source with the fix. The `--dir` flag exists in recent source but hasn't been compiled into a release binary yet.

---

## 5. Model Linting — Planned, Not Built

**Inspiration**: `~/projects/soma/app/src/main/java/io/brokentooth/soma/agent/` — specifically `OpenRouterModels.kt` and `ModelRegistry.kt`.

**Soma's approach** (for reference):
1. Single `GET https://openrouter.ai/api/v1/models` call (no per-model health pings)
2. Five-stage filter: pricing metadata present → output modality includes "text" → drop `:extended` variants → drop `BROKEN_MODELS` (confirmed dead via past live probe) → drop `CULLED_MODELS` (quality/noise pruning)
3. Gemini side: `GET generativelanguage.googleapis.com/v1beta/models` → filter by `generateContent` capability → drop non-chat types by name → restrict to Gemini 3.x only
4. Runtime 429 round-robin: if current free model returns 429, auto-cycle through other free models

**What we want for OpenCode plugin**:
- Fetch available models from configured providers at startup
- Filter dynamically (not just static denylist): capability gate, deduplicate by model family (keep best version, drop old variants of same strain)
- Maintain `BROKEN_MODELS` denylist (populated from live probes)
- Problem: OpenCode plugin API has `tui?: never` — can't inject into model selector dropdown without forking. Can expose filtered list via `command.execute.before` hook as interim.

---

## 6. The Fork — What We're Building

**Repo**: `yourowndog/opencode-1` (this repo, upstream: `anomalyco/opencode` → `sst/opencode`)

### Goals

#### Phase 1 — Model Linter Module
- Build a TypeScript module in this fork that fetches provider model lists and applies smart filtering
- Integrate into the model selector so the dropdown only shows viable, current models
- Requires UI changes to OpenCode's TUI (hence the fork)

#### Phase 2 — TUI Enhancements
- Surface model linter output in the model selector UI
- Better agent/subagent routing visibility
- Fix or surface the opus→opus subagent routing bug (see Section 7)

#### Phase 3 — Server Mode Hardening
- The beksinski `opencode serve` is running, but it's a thin deployment
- Want: proper session persistence, project directory management for remote sessions, better auth story
- Investigate whether `opencode serve` sessions persist across service restarts
- Consider adding API endpoints needed by the Soma Android app for integration

#### Phase 4 — Soma Integration
- Soma app (`~/projects/soma`) is the Android AI chat client
- Long-term: Soma connects to beksinski OpenCode server for agent-backed responses
- Near-term: use Soma's model linting logic as reference for the OpenCode plugin version

### Architecture Note
OpenCode already has `opencode serve` (headless), `opencode web` (server + web UI), and `opencode attach` (TUI client to remote server). No need to build server mode from scratch — it exists. Focus is on making it production-grade for the beksinski deployment and adding the model management features.

---

## 7. Known Bugs / Undiagnosed Issues

### Subagent opus→opus routing bug
- When a subagent task is dispatched, it sometimes routes to claude-opus regardless of the configured agent model
- Not yet diagnosed — needs a session dedicated to reproducing and tracing through agent dispatch code
- Relevant files to look at: agent dispatch in `packages/opencode/src/agent/`

### Phone binary — no fix available
- See Section 4 above
- Needs either a source build from `anomalyco/opencode` with the startup dir fix, or a new upstream release

---

## 8. Session Logs (Evidence)

Located at `~/opencode-config/sessions/` on pyrrhus:

| Session ID | Topic |
|---|---|
| `ses_2df12c8e2ffeGZFwdLqNgyEn41.json` | Configuring OpenCode for OMO-slim in soma project; "Scorched Earth Policy"; native LSP hangs; registering `sams-custom-kotlin-mcp` |
| `ses_2de784f0affeir5MO6453yjCoK.json` | Agent Spectre Gemini 3 Pro configuration |

---

## 9. Key File Locations (pyrrhus)

| Path | Description |
|---|---|
| `~/.opencode/opencode.json` | Main OpenCode config (symlinked from `~/opencode-config/opencode/opencode.json`) |
| `~/.config/opencode/omo-sams-squad.json` | Plugin config (model assignments, agent definitions) |
| `~/projects/omo-sams-squad/` | Plugin source |
| `~/projects/sams-custom-kotlin-mcp/` | Custom LSP MCP source |
| `~/.local/bin/sams-custom-kotlin-mcp` | Compiled LSP MCP binary |
| `~/AGENTS.md` | Root agent instructions |
| `~/.config/opencode/oh-my-opencode-slim/AGENTS.md` | Legacy plugin agent instructions |
| `~/projects/soma/AGENTS.md` | Soma project agent instructions |
| `~/projects/omo-sams-squad/AGENTS.md` | Plugin agent instructions |
| `~/cluster-specs/` | Cluster topology docs (symlinked from `/shared/cluster-specs/`) |
| `~/opencode-config/sessions/` | OpenCode session JSON logs |

---

## 10. Todo List

### Immediate / High Priority

- [ ] **Fix Icarion phone**: Wait for or build a new `opencode` glibc aarch64 binary that properly handles `EACCES` on directory traversal at startup. The `--dir` flag needs to exist in a real binary release. Consider building from `anomalyco/opencode` source.
- [ ] **Diagnose subagent routing bug**: Reproduce the opus→opus routing issue. Trace through `packages/opencode/src/agent/` dispatch logic to find where model assignment is being overridden.
- [ ] **Model linter — initial module**: Write TypeScript module that fetches OpenRouter + Gemini model lists, applies filtering pipeline (capability gate → family dedup → denylist). Port logic from `~/projects/soma/app/.../OpenRouterModels.kt`.

### Medium Priority

- [ ] **Integrate model linter into TUI**: Modify model selector in this fork to use linted model list instead of raw provider list. Requires understanding `packages/opencode/src/tui/` model selector component.
- [ ] **Soma → beksinski integration**: Define the API contract between Soma app and `opencode serve`. What endpoints does Soma need? Session creation, message sending, event streaming (SSE).
- [ ] **Server persistence audit**: Does `opencode serve` on beksinski persist sessions across service restarts? Check where session state is stored on beksinski (`/home/silo/.opencode/` likely).
- [ ] **omo-sams-squad model list**: Add model linter output as a plugin command (interim, before TUI fork is ready). Use `command.execute.before` hook to expose linted list.

### Low Priority / Later

- [ ] **TUI redesign**: Broader UI improvements in the fork — agent routing visibility, better session management UI.
- [ ] **beksinski auth hardening**: Override default `opencode` username with `OPENCODE_SERVER_USERNAME`. Consider rotating the API key.
- [ ] **openclaw cleanup on phone**: `~/.openclaw-android/` still present, remove it.
- [ ] **Dead `$file` artifact on phone**: A literal file named `$file` was accidentally created in Termux home during a bash script error. Clean it up.

---

## 11. How to Resume Work

### Connect to beksinski
```bash
ssh silo@beksinski  # or ssh silo@142.93.94.124
# Check service status
systemctl --user status opencode-serve
```

### Connect to phone (from pyrrhus)
```bash
adb -s R5CY33PBGCX forward tcp:8022 tcp:8022
ssh -p 8022 localhost
# or
ssh icarion  # if SSH config entry is set up
```

### Test beksinski from desktop
```bash
opencode attach https://opencode.brokentooth.io \
  -p 91+eVoNg9CLylRgKmYcDUQ0P3aIfrIr3AvtkWXtpGm4=
```

### Build the plugin
```bash
cd ~/projects/omo-sams-squad
bun run build
```

### Work on this fork
```bash
cd ~/projects/opencode-1
# Upstream: anomalyco/opencode → sst/opencode
# Add upstream remote if needed:
git remote add upstream https://github.com/anomalyco/opencode.git
```
