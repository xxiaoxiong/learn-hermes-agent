# Learn Hermes Agent

> Understand the 19 core mechanisms of a production AI agent, one chapter at a time

[简体中文](./README-zh.md) | [English](./README.md)

---

## What is this?

This is a structured teaching companion for [Hermes Agent](../hermes-agent/), a production-grade AI agent supporting multiple platforms, self-improvement, memory, skills, and scheduling.

Instead of reading the source directly:
- Each core mechanism is isolated into **one chapter**
- Layer 1 (h01–h06) provides **runnable minimal teaching implementations** (Python + OpenAI SDK)
- Layer 2–4 (h07–h19) provides **curated real source snippets** with original line number annotations

## Quick Start

```bash
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your HERMES_BASE_URL / HERMES_API_KEY / HERMES_MODEL
python agents/h01_agent_loop.py
```

## Chapter Overview

| # | Chapter | Core Addition |
|---|---|---|
| h01 | Agent Loop | `while` loop + `tool_result` feedback |
| h02 | Tool System | `ToolRegistry` — schema/handler separation |
| h03 | Planning & Todos | Agent-level tool interception + `PlanState` |
| h04 | Prompt Assembly | `PromptBuilder` — 5-layer dynamic assembly |
| h05 | Context Compression | Preflight compression + `lineage_id` |
| h06 | Session Storage | SQLite + FTS5 full-text search |
| h07 | Memory System | `MEMORY.md` flush + deduplication |
| h08 | Skills System | Skill injection as `user` message |
| h09 | Approval & Permission | `DangerPattern` interception pipeline |
| h10 | Error Recovery | `fallback_providers` chain |
| h11 | CLI Architecture | `COMMAND_REGISTRY` → multi-platform dispatch |
| h12 | Gateway System | `GatewayRunner` + platform adapters |
| h13 | Cron Scheduler | `jobs.json` + skill attachment |
| h14 | Hook System | `pre/post_tool_call` lifecycle |
| h15 | Subagent Delegation | Shared `IterationBudget` across agents |
| h16 | Provider Runtime | `(provider, model)` → `api_mode` mapping |
| h17 | MCP Integration | Dynamic tool discovery + shared registry |
| h18 | Plugin System | `PluginContext` API |
| h19 | RL & Trajectories | ShareGPT trajectory generation + filtering |

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| `HERMES_BASE_URL` | OpenAI-compatible API base URL | `https://api.openai.com/v1` |
| `HERMES_API_KEY` | API key | `sk-...` |
| `HERMES_MODEL` | Model name | `gpt-4o` |
