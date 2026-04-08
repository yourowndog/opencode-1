- To regenerate the JavaScript SDK, run `./packages/sdk/js/script/build.ts`.
- ALWAYS USE PARALLEL TOOLS WHEN APPLICABLE.
- The default branch in this repo is `dev`.
- Local `main` ref may not exist; use `dev` or `origin/dev` for diffs.
- Prefer automation: execute requested actions without confirmation unless blocked by missing info or safety/irreversibility.

## Tooling: Use MCP-based Code Intelligence

### LSP via MCP Bridge (NOT raw LSP tools)
Use the MCP LSP tools for all code navigation. They route through master-lsp-mcp:
- `opencode-ts_hover`, `opencode-ts_definition`, `opencode-ts_diagnostics`, `opencode-ts_references`
- `opencode-html_*` for HTML/Vue files
- `opencode-sql_*` for SQL files

**DO NOT** use raw `lsp_*` or `mcp_lsp_*` tools — they risk system hangs.

### jcodemunch for Code Search (NOT raw grep/glob)
Index first, then search symbols:
```
jcodemunch_index_folder → path: "/home/sam/projects/opencode-fork"
jcodemunch_search_symbols → find functions/classes
jcodemunch_get_file_outline → symbols in a file
jcodemunch_search_text → full-text when symbol search misses
```

### jdocmunch for Documentation
Index docs folders, then search sections:
```
jdocmunch_index_local → path: "/home/sam/projects/opencode-fork/docs"
jdocmunch_search_sections → find relevant docs
```

## Style Guide

### General Principles

- Keep things in one function unless composable or reusable
- Avoid `try`/`catch` where possible
- Avoid using the `any` type
- Prefer single word variable names where possible
- Use Bun APIs when possible, like `Bun.file()`
- Rely on type inference when possible; avoid explicit type annotations or interfaces unless necessary for exports or clarity
- Prefer functional array methods (flatMap, filter, map) over for loops; use type guards on filter to maintain type inference downstream

### Naming

Prefer single word names for variables and functions. Only use multiple words if necessary.

### Naming Enforcement (Read This)

THIS RULE IS MANDATORY FOR AGENT WRITTEN CODE.

- Use single word names by default for new locals, params, and helper functions.
- Multi-word names are allowed only when a single word would be unclear or ambiguous.
- Do not introduce new camelCase compounds when a short single-word alternative is clear.
- Before finishing edits, review touched lines and shorten newly introduced identifiers where possible.
- Good short names to prefer: `pid`, `cfg`, `err`, `opts`, `dir`, `root`, `child`, `state`, `timeout`.
- Examples to avoid unless truly required: `inputPID`, `existingClient`, `connectTimeout`, `workerPath`.

```ts
// Good
const foo = 1
function journal(dir: string) {}

// Bad
const fooBar = 1
function prepareJournal(dir: string) {}
```

Reduce total variable count by inlining when a value is only used once.

```ts
// Good
const journal = await Bun.file(path.join(dir, "journal.json")).json()

// Bad
const journalPath = path.join(dir, "journal.json")
const journal = await Bun.file(journalPath).json()
```

### Destructuring

Avoid unnecessary destructuring. Use dot notation to preserve context.

```ts
// Good
obj.a
obj.b

// Bad
const { a, b } = obj
```

### Variables

Prefer `const` over `let`. Use ternaries or early returns instead of reassignment.

```ts
// Good
const foo = condition ? 1 : 2

// Bad
let foo
if (condition) foo = 1
else foo = 2
```

### Control Flow

Avoid `else` statements. Prefer early returns.

```ts
// Good
function foo() {
  if (condition) return 1
  return 2
}

// Bad
function foo() {
  if (condition) return 1
  else return 2
}
```

### Schema Definitions (Drizzle)

Use snake_case for field names so column names don't need to be redefined as strings.

```ts
// Good
const table = sqliteTable("session", {
  id: text().primaryKey(),
  project_id: text().notNull(),
  created_at: integer().notNull(),
})

// Bad
const table = sqliteTable("session", {
  id: text("id").primaryKey(),
  projectID: text("project_id").notNull(),
  createdAt: integer("created_at").notNull(),
})
```

## Testing

- Avoid mocks as much as possible
- Test actual implementation, do not duplicate logic into tests
- Tests cannot run from repo root (guard: `do-not-run-tests-from-root`); run from package dirs like `packages/opencode`.

## Type Checking

- Always run `bun typecheck` from package directories (e.g., `packages/opencode`), never `tsc` directly.

## Platform Context & Debugging (CRITICAL)

When stepping into this environment, you MUST understand the architecture of the `closedcode` TUI IDE. 
- Use the `jdocmunch` tool to index and read `/home/sam/projects/opencode-fork/docs/reconstruction/`.
- Start by reading `/home/sam/projects/opencode-fork/docs/reconstruction/INIT_SUMMARY.json` to immediately import the system constraints, missing provider fallbacks, UI behaviors (e.g., Gray Screen), and network sync paradigms.
- The `omo-sams-squad` plugin significantly alters runtime behavior vs static configs. Read the documentation before attempting to fix model or orchestrator failures.
