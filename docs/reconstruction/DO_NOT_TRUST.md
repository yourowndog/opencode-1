# DO NOT TRUST

This document aggregates known misdirections and untrustworthy vectors in the ecosystem.

## 1. Models Command Output vs Plugin Reality
[CONFIRMED]
Do not trust the output of `closedcode models anthropic`. 
- **Why**: The global API outputs the hardcoded registry from the Provider manager. However, the plugin `omo-sams-squad` overrides the `opencodeConfig.agent` dynamically and forces a cascading runtime array (`ForegroundFallbackManager`). The model actually answering prompts may differ entirely due to internal rate limit reroutes.

## 2. Startup Logging
[CONFIRMED]
Do not trust synchronous startup logs.
- **Why**: Things like `DEBUG loading internal plugin` output instantaneously and hide the synchronous blockage of `Arborist` fetching packages internally. Successive logs can appear out of order or halt silently without emitting standard exception patterns.

## 3. The `.bak` Config Trap
[CONFIRMED]
Do not trust `opencode.jsonc` configs that exist alongside `.bak` variants without verifying which is loaded.
- **Why**: The Sync framework depends on configurations inside these files. Currently, `opencode.jsonc.bak` exists as an active artifact denoting a disabling of sync services from active production. Attempting to assume sync works based on documentation is a trap.

## 4. PATH Ambiguity
[CONFIRMED]
Do not trust `opencode` versus `closedcode` CLI targets implicitly.
- **Why**: `~/.local/bin/closedcode` and `~/.opencode/bin/opencode` exist mutually but hit differing codebases. Using local `opencode` command will bypass the single-file built executable of `closedcode` and skew test results (it possesses its own `package-lock.json` and sync checks).
