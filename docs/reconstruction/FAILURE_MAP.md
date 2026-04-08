# Failure Map

This is a mandatory readout of known failure paths across subsystems.

## 1. Bun Install Hang
[CONFIRMED]
- **Symptom**: CLI hangs at `"Resolving dependencies"` during startup.
- **Subsystem**: `Plugin / NPM (Arborist)`
- **Root Cause**: The plugin loader initiates an `@npmcli/arborist` virtual tree build when `node_modules` is perceived out-of-sync or missing in `~/.config/opencode` or `~/.opencode`. Complex plugin references or network hitches stall `Arborist` synchronously.
- **Evidence**: `INFO service=npm node_modules missing, reifying` followed by infinite halt.
- **Repro steps**: Delete `~/.config/opencode/node_modules` and run `closedcode run "test"`.
- **Severity**: **CRITICAL** (Blocks execution entirely).

## 2. Gray Screen
[CONFIRMED]
- **Symptom**: Process starts without standard errors, but UI completely vanishes rendering gray background.
- **Subsystem**: `TUI Layer`
- **Root Cause**: SolidJS signal `session()` evaluates to falsy / null due to a `Not Found` or corrupted session return. TUI handles this identically to an empty buffer.
- **Evidence**: UI depends solely on `session()` evaluation for component dispatch.
- **Repro steps**: Attempt to attach or continue a session ID not present in the local database.
- **Severity**: **CRITICAL**.

## 3. Plugin Load Failure
[INFERRED]
- **Symptom**: Agent behaviors missing and default fallback fails.
- **Subsystem**: `Plugin Loader`
- **Root Cause**: Path mismatch on `file:///` URLs or malformed `config.json`.
- **Severity**: **HIGH**.

## 4. Missing Provider Models 
[CONFIRMED]
- **Symptom**: Commands like `closedcode models` show available models, but agents fail due to provider rejection or context errors.
- **Subsystem**: `Agent / omo-sams-squad plugin`
- **Root Cause**: The `ForegroundFallbackManager` dynamically switches the actual targeted model during a failure hook. System outputs misreport what is currently active because plugins override the defaults post-instantiation.
- **Severity**: **MEDIUM**.

## 5. Session Non-Persistence across Contexts
[CONFIRMED]
- **Symptom**: Work in one terminal/host cannot be resumed or seen in another host.
- **Subsystem**: `Sync Client / Beksinski`
- **Root Cause**: Sync is practically disabled via configuration misalignments (`.bak`). The `remote.ts` push hooks are never triggered.
- **Evidence**: `opencode.jsonc.bak` references logic without deployment hooks.
- **Severity**: **HIGH**.
