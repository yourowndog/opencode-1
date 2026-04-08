# Boot Sequence

This document maps the critical path from executing `closedcode` to the TUI rendering text.

## 1. CLI Entrypoint
[CONFIRMED]
- **Invoked**: `~/.local/bin/closedcode` (Bun single-file executable).
- **What happens**: `yargs` parses arguments (e.g., `run "hi"`). It configures the logger and global paths.
- **Can fail**: If `closedcode` is not in PATH, or if an unrecognized command causes `yargs` to exit.

## 2. Environment & Database Bootstrap (Effect-ts)
[CONFIRMED]
- **What happens**: `Instance.provide(...)` initializes the Effect ecosystem. 
- **What happens**: SQLite database runs migrations synchronously. The `opencode.db` is opened.
- **Must succeed**: Database must not be locked or corrupt.
- **Failure manifest**: Halts with a synchronous initialization error or stuck migration progress log.

## 3. Plugin Resolution & Dependency Checks (The Bottleneck)
[INFERRED based on NPM/Arborist logic]
- **What happens**: The system checks `~/.config/opencode` (and `.opencode/`) for plugins defined in `config.json` (e.g., `file:///home/sam/projects/omo-sams-squad`).
- **What happens**: `@npmcli/arborist` compares `package.json` with `package-lock.json` and existing `node_modules/`. If it thinks files are missing, it triggers an auto-install (`reifying`).
- **Must succeed**: The package manager must resolve and fetch all sub-dependencies over the network OR locally.
- **Failure manifest**: Application **hangs indefinitely** at `"Resolving dependencies"` (an arborist/bun fetch stall). 

## 4. MCP & Provider Initialization
[CONFIRMED]
- **What happens**: Auth plugins (Cloudflare, Anthropic, Gemini) are booted. Provider API checks are made. MCP servers (like `brave-search`, `github-mcp-server`) are spawned.
- **Must succeed**: Configured models and API keys must be valid.
- **Failure manifest**: Silent degradation or logs indicating an MCP server timeout/disconnect.

## 5. Session Resuscitation / Creation 
[CONFIRMED]
- **What happens**: The command creates a new session in SQLite containing the user prompt (`"hi"`), or loads an existing ID.
- **Must succeed**: Session ID must point to a valid aggregate root.
- **Failure manifest**: Session data missing across machines creates a paradox where local SQLite lacks the session -> throws `BusyError` or `NotFound`.

## 6. TUI Render Binding
[CONFIRMED]
- **What happens**: SolidJS TUI binds its state to the `session()`.
- **Must succeed**: The `session()` object cannot evaluate to falsy.
- **Failure manifest**: If the session lookup fails or `session()` returns `null/undefined`, SolidJS renders an empty reactive container → **Gray Screen**.
