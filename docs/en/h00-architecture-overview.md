# h00 — Hermes Agent Architecture Overview

> This is the map for the entire course. Before diving into any chapter, build a mental picture of Hermes as a whole.

---

## 1. What Is Hermes

Hermes Agent is a **production-grade AI Agent framework** with the following core capabilities:

- Interact with the OS and network through tools (bash, file I/O, HTTP requests)
- Gateway integration for 15+ messaging platforms (Telegram, Discord, Slack…)
- Multi-model / multi-provider runtime (OpenAI, Anthropic, OpenRouter…)
- Full session persistence and context compression
- Multiple extension surfaces: plugins, skills, MCP

---

## 2. Four-Layer Architecture

Hermes' 19 core mechanisms are organized into 4 layers, each addressing a distinct class of problems:

```
Layer 1: Core Single-Agent      h01 – h06
  "The minimum a single agent needs"
  Message loop → Tool system → Task planning → Prompt assembly → Context compression → Session storage

Layer 2: Production Hardening   h07 – h11
  "Making an agent reliable"
  Memory system → Skills → Approval gating → Error recovery → CLI architecture

Layer 3: Multi-Platform Runtime h12 – h15
  "Serving multiple platforms"
  Gateway → Cron → Hooks → Subagent

Layer 4: Advanced Platform      h16 – h19
  "Becoming an extensible platform"
  Provider Runtime → MCP → Plugins → RL Trajectories
```

---

## 3. Core Components and File Mapping

### 3.1 Main Loop

| File | Purpose |
|---|---|
| `run_agent.py` | `AIAgent` class: message loop, tool dispatch, budget control |
| `tools/registry.py` | `ToolRegistry`: schema + handler registry |
| `agent/prompt_builder.py` | `PromptBuilder`: 5-tier section dynamic assembly of system prompt |
| `agent/context_compressor.py` | `ContextCompressor`: context compression strategy |
| `hermes_state.py` | `HermesState`: SQLite session persistence + FTS5 |

### 3.2 Production Hardening

| File | Purpose |
|---|---|
| `agent/memory_manager.py` | `MEMORY.md` / `USER.md` write and dedup |
| `tools/memory_tool.py` | Memory write tool handler |
| `agent/skill_commands.py` | Skill file discovery and user message injection |
| `tools/approval.py` | `DangerPattern` detection + allowlist + callback |

### 3.3 Gateway and Multi-Platform

| File | Purpose |
|---|---|
| `gateway/run.py` | `GatewayRunner`: message dispatch main loop |
| `gateway/platforms/` | Platform adapters (Telegram, Discord, Slack…) |
| `cron/scheduler.py` | Scheduled task scheduler |
| `gateway/hooks.py` | HookEvent lifecycle management |
| `tools/delegate_tool.py` | Subagent spawn + budget sharing |

### 3.4 Platform Capabilities

| File | Purpose |
|---|---|
| `hermes_cli/runtime_provider.py` | Provider resolution: provider → api_mode |
| `hermes_cli/auth.py` | `CredentialPool`: multi-account rotation |
| `tools/mcp_tool.py` | MCP server dynamic tool discovery |
| `hermes_cli/plugins.py` | `PluginContext`: plugin registration interface |
| `batch_runner.py` | RL trajectory parallel generation |

---

## 4. Data Flow

### 4.1 Complete Data Flow for a Single Conversation

```
User input
  └─→ run_agent.py: AIAgent.run_conversation()
        └─→ prompt_builder.py: assemble system prompt (incl. MEMORY.md / skills)
        └─→ OpenAI/Anthropic API call
        └─→ Parse tool_calls
              └─→ approval.py: danger detection
              └─→ registry.py: dispatch to handler
              └─→ Tool result appended to messages
        └─→ Repeat loop until model stops calling tools
        └─→ memory_manager.py: flush memory before turn ends
        └─→ hermes_state.py: save session to SQLite
```

### 4.2 Gateway Data Flow

```
Platform message (Telegram / Discord…)
  └─→ gateway/platforms/[adapter].py: convert to MessageEvent
  └─→ gateway/run.py: GatewayRunner._handle_message()
        └─→ session routing (platform + user_id → session_key)
        └─→ AIAgent.run_conversation() (same flow as above)
        └─→ delivery: send result back to platform
```

---

## 5. Key Design Decisions

### Decision 1: Separate tool schema from handler

The model only sees the schema; code only calls the handler. They are bound by `name`. Adding a tool never touches the main loop.

### Decision 2: todo tool is intercepted before the registry

`todo` mutates the agent's internal state (PlanState) and does not go through ToolRegistry. This ensures the agent's self-tracking is independent of the tool registration order.

### Decision 3: Skills are injected as user messages, not system prompt

Keeping the system prompt content stable ensures high cache hit rates for Anthropic prompt caching.

### Decision 4: Compression preserves lineage instead of deleting history

Compression creates a new session (new `lineage_id`); the original session still exists in SQLite and can be retrieved via FTS5.

### Decision 5: The safety gate lives at the dispatch layer, not inside tools

`approval.py` intercepts all tool calls before ToolRegistry dispatch, ensuring a unified danger-detection logic.

---

## 6. Recommended Reading Order

```
Must-read (Layer 1): h01 → h02 → h03 → h04 → h05 → h06
  These 6 chapters build the core mental model. Each introduces one new concept and can be run independently.

On-demand (Layer 2): h07 → h08 → h09 → h10 → h11
  Production hardening — read as needed.

Elective (Layer 3 & 4): h12 → h19
  Multi-platform and advanced capabilities — choose based on your needs.
```

---

> **Tip:** The Code tab for each chapter shows the corresponding Python implementation (h01–h06 are teaching implementations; h07–h19 are curated Hermes source snippets). We recommend reading the docs and code side by side.
