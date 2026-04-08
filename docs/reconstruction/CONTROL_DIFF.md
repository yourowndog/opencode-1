# Control Diff

Comparing `opencode` (Control) vs `closedcode` (Fork)

## What Works in Upstream (`opencode`)
[CONFIRMED]
- Plugin package reifying typically succeeds because the pathing logic maps inherently to `.opencode/` instead of bifurcating between `.opencode/` and `.config/opencode/`.
- Executables run natively without Bun standalone containerization restrictions on child process forks regarding LSP integrations.
- Local TUI renders correctly when pure configurations instantiate internal auth seamlessly.

## What Fails in Fork (`closedcode`)
[CONFIRMED]
- Bun's standalone bundle compilation complicates dynamic `import()` semantics that local `Arborist` installations attempt to map over.
- The `omo-sams-squad` plugin attempts to dynamically bind models leading to "Missing provider models" logic breaking generic runs.
- Startup halts at `Resolving dependencies` because of dual-context resolution attempting to manage `~/.config/opencode` parallel to `opencode-fork/.opencode`.

## Key Divergences
[CONFIRMED]
1. **Binary Location**: `~/.local/bin/closedcode` (fork built artifact) vs `~/.opencode/bin/opencode` (control native script).
2. **Sync Integrations**: The fork attempted a massive integration for `beksinski` SQLite replication.
3. **Agent Overrides**: The fork leans strictly into overriding `@modelcontextprotocol` tool injections and enforcing a multi-layered subagent taxonomy (e.g., explicitly enforcing `orchestrator` over the control defaults).
