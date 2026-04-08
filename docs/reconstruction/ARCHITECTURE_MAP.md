# Architecture Map

[CONFIRMED]
The `closedcode` fork maintains the `opencode` core structure, utilizing dependency injection (Effect-ts) to wire distinct subsystems together.

## Subsystems

### 1. CLI Layer (`packages/opencode/src/cli/`)
- Uses `yargs` to parse input.
- Initializes environment flags and invokes `bootstrap()`.
- Acts as the outer control flow wrapper.

### 2. TUI Layer (`packages/ui/`)
- Built on `SolidJS` via `@opentui/core`.
- Reactive. Evaluates signals based on the `session()`.
- Renders command outputs as interactive terminal components.

### 3. Session System (`packages/opencode/src/session/`)
- Sits on top of SQLite (via Drizzle/SQL).
- Stores the event history consisting of messages, models, parts, and tokens.
- Manages parent/child hierarchies (forks).

### 4. Agent & Orchestrator System (`packages/opencode/src/agent/`)
- Interfaces with `Provider` models (e.g. Anthropic, Gemini, OpenRouter) to broker reasoning passes.
- Orchestrates multi-agent interactions (e.g., spinning up specialized sub-agents with limited toolsets to fetch files in the background).
- Handles protocol mapping for tool execution and validation logic.
- Heavily modified at runtime by external configs (e.g., `omo-sams-squad`'s `ForegroundFallbackManager` for dynamic model routing).

### 5. Plugin System (`packages/opencode/src/plugin/`)
- The "glue" for third-party behavior. Dynamically loads `.json` configuration and executes dynamic ES module imports to extend base functionality.
- Triggers `@npmcli/arborist` if local node modules are missing or need hydration.
- Injects critical lifecycle hooks (e.g., intercepting `experimental.chat.messages.transform` to enforce AI workflows behind the scenes).

### 6. Event Sync System (`beksinski`)
- Hub-and-spoke model syncing SQLite sessions to a central VPS (`142.93.94.124`).
- Driven by `SyncEvent.run()` persisting events.
- **Currently Disabled** via `.bak` extension in configs, meaning all operations are purely offline/local.

## Flow Mapping
```
CLI -> Bootstrap -> Config Load -> Arborist (NPM Sync) -> Plugin Init -> DB Auth -> Session Load -> TUI Reactive Rendering -> Agent Dispatch -> LLM API
```
