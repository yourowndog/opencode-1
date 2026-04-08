# Minimal Working Path

To guarantee a successful boot sequence avoiding major hang traps.

## Minimal Configuration
[CONFIRMED]
A minimal configuration must target an active local node installation without un-reified plugins, or strictly rely on built-ins.

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "anthropic/claude-3-5-sonnet-20241022",
  "plugin": [],
  "mcp": {}
}
```

## Required Dependencies

**Runtime**:
1. Bun 
2. SQLite (Native binary built into bun runtime)

**Directories**:
1. `~/.local/share/opencode/` containing `auth.json` and `opencode.db`
2. `~/.config/opencode/` 

## The Plugin Paradox
[CONFIRMED]
- The required provider auth protocols (`opencode-gemini-auth` / `opencode-claude-auth`) depend on the plugin subsystem to load.
- If `config.json` attempts to define `model` but excludes the explicit `plugin` inclusion of the auth logic, the system lacks credentials logic.
- If `plugin` arrays are populated, the slow/fragile `Arborist` is invoked.
- **Workaround**: Boot with pure offline flags (`--pure`) or isolate dependencies before allowing boot loader to auto-reify.
