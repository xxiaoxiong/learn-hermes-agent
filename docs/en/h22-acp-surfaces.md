# h22 — ACP and Agent Surfaces: One Core, Many Interfaces

Hermes CLI, TUI, Desktop, Gateway, API Server, Python library, and ACP are not separate agents. They are adapters over the same `AIAgent`.

Every surface eventually calls the shared conversation engine, preserving the semantics of provider resolution, prompt assembly, tool dispatch, compression, and session persistence. Surface code normalizes input, maps reasoning/text/tool/progress events back to the client, and handles interruption or capability differences.

Agent Client Protocol exposes Hermes to editors such as VS Code, Zed, and JetBrains over stdio/JSON-RPC. The ACP adapter translates IDE requests and events; it does not reimplement the agent loop.

This boundary prevents behavior from drifting across clients. A new surface implements protocol translation while inheriting the same agent capabilities and security model.

**Official source areas:** `acp_adapter/`, `cli.py`, `gateway/run.py`, and Desktop/TUI event layers.
