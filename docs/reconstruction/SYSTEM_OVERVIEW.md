# System Overview

![Overview](/home/sam/projects/opencode-fork/img/placeholder.png)

## What is a TUI IDE?

[CONFIRMED]
A TUI (Text User Interface) IDE is a development environment that runs entirely in the terminal, utilizing text-based graphics rather than a traditional GUI (like VSCode) to provide a rich interactive experience. It handles layouts, input capture, and renders UI components using ASCII/ANSI primitives.

In the case of `closedcode`, the TUI is specifically designed to function as an AI-first development companion. It orchestrates interactions between the user, local workspace states, and multiple large language models (LLMs like Claude or Gemini). The text interface binds smoothly to streamed LLM outputs to present interactive diffs, conversational loops, and tool execution feedback directly in the terminal window.

## Exploring `closedcode`

[CONFIRMED]
`closedcode` is a fork of an upstream project called `opencode`, repackaged as a standalone `bun` single-file binary. It is built on top of:
- **Bun**: Providing the JS/TS runtime.
- **SolidJS**: Powering the reactive component model for the terminal (via `@opentui/core` and `@opentui/solid`).
- **Effect-ts**: Providing robust functional error handling, context management, and services for the application logic.

### User Interaction Lifecycle

[CONFIRMED]
When a user launches `closedcode` and begins typing:
1. The **CLI Layer** matches the command (e.g., `closedcode run "hi"`).
2. The **Runtime** bootstraps Effect-ts services, config loaders, and database connections.
3. The **Session** layer ensures an active context exists (an interaction history tied to a workspace).
4. The **TUI** binds to the session's stream and renders message deltas using SolidJS.
5. The **Orchestrator Agent** evaluates the user input, decides whether to use a tool, invoke Sub-Agents, or respond directly.

## Plugins & Sessions Interaction

[CONFIRMED]
- **Sessions** represent long-running conversational instances. They are persisted via SQLite, forming the bedrock of user history and state. A session encapsulates prompts, code changes, token usage, and AI model choices. If a session is missing or corrupts, the TUI has no state to bind to.
- **Plugins** (like `omo-sams-squad`) provide the core extendability. They register custom Agents, Configs, MCPs (Model Context Protocol servers), and Tools dynamically. Unlike traditional IDE extensions, these plugins can radically reconstruct the AI workflow—they can define fallback chains for rate limits, enforce workflow compliance reminders before executing prompts, or spawn background instances (via Tmux) to process work transparently while the user continues interacting.
