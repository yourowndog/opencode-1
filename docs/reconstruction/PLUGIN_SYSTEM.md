# Plugin System

[CONFIRMED]
The Plugin System provides runtime extensibility for Agents, Rulesets, Hooks, and MCPs without altering upstream binaries.

## Discovery and Install
1. `plugin/loader.ts` parses `config.json`'s `"plugin"` array.
2. If given a URI like `file:///home/sam/projects/omo-sams-squad`, it maps it locally.
3. The plugin manager leans on `packages/opencode/src/npm/index.ts` to verify `node_modules`. If missing or out of sync with `package-lock.json`, it instantiates `arborist` and blocks execution waiting for the tree to reify.
4. **Failure State**: Arborist can hang arbitrarily when resolving complex sub-dependencies, resulting in a silent startup stall.

## Registration
- Plugins expose default exports typing to `Plugin` (`@opencode-ai/plugin`).
- Injected at runtime, returning maps of agents, tools, MCPs, and lifecycle hooks (`tool.execute.after`, `experimental.chat.system.transform`).

## `omo-sams-squad` Lifecycle
[CONFIRMED]
This plugin drastically alters system behavior:
1. **Config Injection**: Overrides the `default_agent` to be `'orchestrator'`.
2. **Dynamic Resolution**: Dynamically reads array declarations of models and sets up a `ForegroundFallbackManager`.
3. **Runtime Mutation**: Intercepts events (`chat.headers`, `session.status`) before sending payloads to APIs to enforce workflow compliance and do intelligent automatic retries on tool errors.
4. **Agent Exposure**: Overwrites standard agent logic by providing custom multi-model, multi-step subagent variants like the orchestrator.
