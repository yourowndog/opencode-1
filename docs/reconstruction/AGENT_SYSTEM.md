# Agent System

[CONFIRMED]
Agents combine models, system prompts, permissions, and tools to shape the orchestrator loop. The core framework registers agents at boot via `config.json` and static definitions, which are subsequently resolved into a global `Agent` service.

## The Orchestrator
[CONFIRMED]
`omo-sams-squad` overwrites the global `default_agent` targeting the name `'orchestrator'`. This sets up the central routing and decision logic. 

## "Cloning Itself" Paradox
[INFERRED]
The orchestrator may appear to "clone itself" outputting duplicate or non-matching representations due to the `ForegroundFallbackManager`. 
- **Mechanism**: The plugin defines `_modelArray`s and fallback chains for runtime reliability. 
- **The Issue**: It takes an array of models and dynamically rewrites `opencodeConfig.agent[name].model` sequentially to perform rate-limit avoidance and network retries. This creates a divergence between the `models` command output (what the base system knows is configured) and what the orchestrator actively loads at runtime via the plugin interception.

## Sub-agents
[CONFIRMED]
Agents flagged as `subagent` are invoked functionally via tools, typically spinning up background sub-trees within the execution loop (e.g., executing background terminal logic asynchronously to avoid blocking the main TUI render thread).
