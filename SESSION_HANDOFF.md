# SESSION HANDOFF

## 1. PRIMARY OBJECTIVE
- Finalize and stabilize the `closedcode` fork so the workstation is reliable before starting the paid app work.
- Priority order from user:
  1. Fix subagent orchestration reliability first
  2. Make sure `opencode`/`closedcode` can be closed and reopened safely with sessions intact
  3. Regain confidence in delegated multi-agent workflow
  4. Only then do the broad rename everywhere: local, Pyrrhus, GitHub, downstream integrations
- Must stay token-conscious.
- If blocked or looping, stop and ask the user for instructions.

## 2. CURRENT SYSTEM / ARCHITECTURE
- Repo currently lives at: `~/projects/opencode-fork`
- Fork branding / CLI target name: `closedcode`
- Local binary target: `~/.local/bin/closedcode`
- Main config paths still use opencode naming:
  - `~/.config/opencode/opencode.json`
  - `~/.opencode/opencode.json` → symlink to the above
- Main data dir still uses opencode naming:
  - `~/.local/share/opencode/`
- Main DB:
  - `~/.local/share/opencode/opencode.db`
- Dev/channel DBs also exist in same dir, including:
  - `opencode-dev.db`
  - `opencode-pyrrhus.db`
- Plugin integration is dynamic, not baked into the binary:
  - config points plugin `omo-sams-squad` to `file:///home/sam/projects/omo-sams-squad`
- Pyrrhus host info from cluster specs:
  - SSH: `ssh pyrrhus`
  - direct IP: `10.0.0.2`
  - machine: ThinkPad T480
- Upstream official `opencode` updates through `v1.3.17` were already merged into the fork.

## 3. DECISIONS ALREADY MADE
- **DECIDED**: The fork name is `closedcode`.
- **DECIDED**: CLI commands should use `closedcode` instead of `opencode`.
- **DECIDED**: The ASCII logo now correctly renders `CLOSEDCODE`.
- **DECIDED**: Auto-update behavior was disabled in `packages/opencode/src/cli/upgrade.ts` so the fork does not overwrite itself from upstream.
- **DECIDED**: Broad rename of repo/directories/GitHub/Pyrrhus should wait until workstation stability is proven.
- **DECIDED**: User prefers stop-and-check workflow over long autonomous loops.
- **DECIDED**: Token-saving work like long builds/compiles should be offloaded to the user via shell commands when possible.

## 4. ACTIVE WORK IN PROGRESS
- **ACTIVE**: Verify fix for barren `closedcode` session list.
- **ACTIVE**: Diagnose subagent orchestration reliability.
- **PENDING**: Rename local repo and related paths from `opencode-fork` to `closedcode`.
- **PENDING**: Deploy/sync the stabilized fork to Pyrrhus.
- **PENDING**: Eventually rename on GitHub and in downstream integrations once stability is confirmed.

## 5. RECENT CONTEXT THAT MUST NOT BE LOST
- User is specifically concerned about two things right now:
  1. Subagent orchestration has been unreliable and is causing loss of confidence.
  2. `closedcode` launched with an empty session list, while `opencode` still showed all session data.
- The conclusion reached was:
  - this is very likely **not** a user invocation/naming problem
  - it is likely a provider/model/fallback/auth/infra issue in the subagent orchestration layer
- Evidence seen:
  - `Task` invocations failed with `ProviderModelNotFoundError`
  - a Spectre background task failed with `All fallback models failed` and `JSON Parse error: Unexpected EOF`
- The previous explanation for barren sessions was:
  - `closedcode` appeared to be reading a non-primary database such as `opencode-dev.db` rather than the real `opencode.db`
- Code inspection found:
  - `packages/opencode/src/global/index.ts` still uses `const app = "opencode"` for XDG directory naming
  - `packages/opencode/src/storage/db.ts` was using channel-based DB naming
- A patch has already been applied to force the DB path back to the main DB.

## 6. OPEN QUESTIONS / UNRESOLVED CHOICES
- **OPEN**: Does the DB path patch fully solve the barren session issue once rebuilt and relaunched?
- **OPEN**: What exact provider/model config is breaking subagent tasks?
- **OPEN**: Should config/data directories remain under `opencode` naming for compatibility, even after the repo/binary rename?
- **OPEN**: On Pyrrhus, should we replace the existing `~/projects/opencode-fork` in place, rename it, or wipe and redeploy fresh after local stabilization?
- **OPEN**: When broad rename happens, what downstream tools/integrations (antigravity, ChatGPT desktop app, etc.) will need path updates?

## 7. KNOWN PROBLEMS / RISKS
- **RISK**: Subagent orchestration is currently unreliable; repeated failures could waste tokens and user trust.
- **RISK**: Broad renaming before workstation stability may break configs, scripts, symlinks, or downstream tool integrations.
- **RISK**: The DB fix has been applied but not yet verified by rebuild/runtime test.
- **RISK**: Pyrrhus currently has its own `~/projects/opencode-fork` state that may drift from local.
- **BLOCKED**: Cannot confidently proceed with heavy multi-agent execution until orchestration health is proven.

## 8. DO-NOT-RELITIGATE LIST
- Do not reopen logo design.
- Do not reopen whether the fork should be named `closedcode`.
- Do not rush the massive rename before stability checks pass.
- Do not assume the subagent problem is due to improper agent naming; current evidence points elsewhere.
- Do not burn tokens watching builds if the user can run them locally.

## 9. IMMEDIATE NEXT STEPS
1. Have the user rebuild the binary locally with the already-provided commands:
   ```bash
   cd ~/projects/opencode-fork/packages/opencode
   bun run build --single --skip-install --skip-embed-web-ui
   cp dist/opencode-linux-x64/bin/closedcode ~/.local/bin/closedcode
   chmod +x ~/.local/bin/closedcode
   closedcode
   ```
2. Get a one-line checkpoint from user:
   - `sessions are back`
   - `still barren`
   - `build failed: ...`
3. If sessions are back, run one tiny subagent health diagnostic.
4. If still barren, inspect runtime DB path and stop for instruction if diagnosis branches.
5. Only after both session continuity and subagent reliability are validated, plan the rename rollout locally/Pyrrhus/GitHub.

## 10. NEXT-SESSION BOOTSTRAP PROMPT
- We are **not** starting from scratch. Resume from this state.
- User priorities, in order:
  1. Fix subagent orchestration reliability first
  2. Make sure `opencode`/`closedcode` can be closed and reopened safely with sessions intact
  3. Regain confidence in delegated multi-agent workflow
  4. Only then do the broad rename everywhere: local, Pyrrhus, GitHub, downstream integrations
  5. Stay token-conscious
  6. If blocked or looping, stop and ask the user for instructions
- Important recent findings:
  - subagent failures appear to be provider/model/fallback/auth/infra issues, not bad agent naming
  - evidence: `ProviderModelNotFoundError`, `All fallback models failed`, `JSON Parse error: Unexpected EOF`
  - `closedcode` showed an empty session list while `opencode` still had all sessions
  - likely cause: wrong DB path (eg `opencode-dev.db` instead of `opencode.db`)
- Active code change already applied:
  - file: `~/projects/opencode-fork/packages/opencode/src/storage/db.ts`
  - `getChannelPath()` was changed to always return `path.join(Global.Path.data, "opencode.db")`
- This DB fix is **not yet verified**.
- User was told to run:
  ```bash
  cd ~/projects/opencode-fork/packages/opencode
  bun run build --single --skip-install --skip-embed-web-ui
  cp dist/opencode-linux-x64/bin/closedcode ~/.local/bin/closedcode
  chmod +x ~/.local/bin/closedcode
  closedcode
  ```
- First question in the next session should be:
  - Did the build succeed, and are sessions back or still barren?
