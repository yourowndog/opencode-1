# Investigation Playbooks

Strict ordered procedures for investigating runtime anomalies.

## Startup Hang

1. **Verify Binary**: `which closedcode` -> ensure it resolves to `~/.local/bin/closedcode`.
2. **Execute with max logging**: `closedcode run "ping" --print-logs --log-level DEBUG`.
3. **Trace Arborist Block**: Evaluate stdout for `node_modules missing, reifying`.
4. **Bypass Check**: Execute `bun install --cwd ~/.config/opencode/` explicitly with an external timeout parameter. Track which node package hangs.
5. **Escape Hatch**: Run `closedcode run "ping" --pure` to skip plugins and verify core TUI boots.

## Gray Screen

1. **Validate Session ID**: Search sqlite for the specific identifier throwing null.
   ```bash
   sqlite3 ~/.local/share/opencode/opencode.db "SELECT id FROM session ORDER BY time_created DESC LIMIT 1;"
   ```
2. **Check App Output**: `tail -n 100 ~/.local/share/opencode/opencode.log`
3. **Verify Parent Constraints**: The session must not reference a corrupted or remote-only `parent_id`.

## Model Not Responding

1. **Rule out Fallback Overwrites**: Check `file:///home/sam/projects/omo-sams-squad`'s internal hook mapping. Is `ForegroundFallbackManager` replacing your targeted model with an exhausted fallback constraint?
2. **Review Config**: `cat ~/.config/opencode/config.json`.
3. **Trigger Auth Dump**: `closedcode providers list --print-logs` to confirm creds are active.

## Session Not Syncing

1. **Ping Hub**: Use curl explicitly.
   ```bash
   curl -u opencode:'91+eVoNg9CLylRgKmYcDUQ0P3aIfrIr3AvtkWXtpGm4=' http://142.93.94.124:3001/sync/health
   ```
2. **Verify Client Target**: Check `opencode.json` block for correct server and identity tags (`"source": "pyrrhus"`).
3. **Check .bak Isolation**: Ensure the `.bak` suffix isn't actively disabling the internal configuration parameters holding sync logic.
