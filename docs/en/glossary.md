# Glossary

> This glossary covers only the most frequently appearing and most easily confused terms in `learn-hermes-agent`.
> If you encounter a word that feels like "I sort of understand it, but can't clearly say which layer it belongs to in the system," come back here to recalibrate.

---

## Recommended Reading Order

If you're no longer just looking up words but starting to lose track of "which layer these terms live in and which structures they bind to," try reading these together:

- First see [`h00-architecture-overview.md`](./h00-architecture-overview.md): Build the 19-chapter panoramic view.
- Then see [`data-structures.md`](./data-structures.md): Map terms to their actual data structures.
- If you're stuck on "what's the boundary between memory and session," revisit `h06` and `h07`.
- If you're stuck on "skill, plugin, and MCP all seem like extension mechanisms," revisit `h08`, `h17`, `h18`.

---

## Agent

In this project, `agent` refers to:

**A model-driven execution entity that makes judgments based on context and calls tools when needed to advance tasks.**

You can understand it in two parts:

- The model handles reasoning, planning, and deciding the next action
- Code provides the runtime environment, tools, permissions, and state management

In other words, the model is not the entire agent; the model is just the agent's "brain."

---

## Agent Loop

`agent loop` is the system's most core closed loop:

1. Read the current `messages`
2. Assemble the prompt
3. Call the model
4. Determine whether the model gave a direct answer or requested a tool
5. If a tool was requested, execute it and write the result back to context
6. Continue the next iteration until the model stops

Without the loop, there's only "one question, one answer"; with the loop, there's a truly continuously working agent.

---

## Message / Messages

`message` is a single message; `messages` is a list of messages.

It typically contains: user input, assistant output, tool results, and in some implementations, structured tool call blocks.

`messages` is not a database or long-term memory; it's **the most important temporary context container for the current working round.**

---

## Tool

A `tool` is an action that the model can request code to execute.

Examples: read file, write file, search text, run shell commands, call external services.

The model itself doesn't directly execute OS commands. The model only says: which tool to call and what the parameters are. The actual action is performed by a handler registered in code.

---

## Tool Schema

`tool schema` is the "instruction manual" shown to the model. It must specify at minimum: tool name, purpose, input parameters, parameter types and constraints.

In Hermes' style, schema and handler are separated because:

- The model needs to understand "how to use this tool"
- Code needs to know "how to execute this tool"

These are not the same concern.

---

## Tool Registry

`ToolRegistry` is the tool registration table. It maintains a mapping: `tool name` → `handler` and `tool name` → `schema`.

The main loop only needs to: collect tool definitions for the model and dispatch by name to the corresponding implementation. The main loop doesn't need to know each tool's details.

---

## Agent-level Tool

`agent-level tool` refers to tools that **don't go through the normal registry dispatch path but are prioritized for interception in the main loop.**

The most typical example in this project: `todo`.

Because it modifies not the external world but the agent's own execution state.

- Normal tools modify the external environment
- Agent-level tools modify the agent's internal state

---

## Plan / Todo

`plan` is the execution structure after task decomposition; `todo` is a single step within a plan.

A `todo` generally has: id, description, status (`pending` / `in_progress` / `completed`).

Its value isn't "listing tasks for aesthetics" but giving the agent the most basic introspective ability over its own progress.

---

## Prompt Assembly

`prompt assembly` means the system prompt isn't a single hardcoded large string but **assembled from multiple sections at runtime.**

Common section sources in Hermes' style: personality/role, memory, skills, context files, tool guidance.

This lets prompts change with state while maintaining manageable structural boundaries.

---

## System Prompt

`system prompt` is the system-level instruction layer. Its responsibilities typically include: specifying behavioral boundaries, collaboration rules, tool usage principles, and output style / safety constraints.

In Hermes' teaching context, a key point is:

**The system prompt handles stable, high-priority rules; skills are more like temporary operating guides.**

---

## Skill

A `skill` is an operating guide that can be injected to the agent.

It typically doesn't define personality but rather: how to do a certain type of task, what steps to follow, what scenarios to watch out for.

In Hermes, skills are injected via `user message` rather than `system prompt`, with the key purpose of: not disrupting system prompt stability and improving prompt cache hit rates.

---

## Memory

`memory` refers to information retained across sessions.

Its biggest difference from normal context: context only exists temporarily within the current session; memory is designed to persist across sessions.

Content suitable for memory is typically: long-term user preferences, frequently recurring important facts, information with ongoing value for future tasks.

Not everything should be remembered.

---

## Session

A `session` is a conversational unit of one continuous work process.

It generally corresponds to: a set of continuous `messages`, a recoverable context state, a persistable database record.

In `h06`, the key point about sessions isn't "chat logs" but:

**It lets the agent resume after interruption and makes past history searchable.**

---

## Lineage

`lineage` is the genealogy relationship between sessions.

It's especially important during context compression:

- Compression may produce a new session
- The new session records its parent session
- Even if the current window is compressed, the system can still trace back to earlier complete history

Lineage's value isn't displayed in UI but ensures state trackability.

---

## Context Compression

`context compression` is the mechanism for compressing and reorganizing history after context grows long.

Two key points for correct understanding:

- It's not simply deleting old messages
- Its goal is to preserve recent working memory while folding earlier history into summaries

Hermes' style emphasizes: preserve the most recent N messages, compress middle-layer history, and maintain tool call / tool result pair integrity.

---

## Approval / Permission

`approval` or `permission` is the safety judgment layer before tool execution.

The problem it solves isn't "can the tool be written" but: is this call dangerous, can it be automatically allowed, must the user be asked, or should it be directly rejected.

Hermes' important design point: **the safety gate is handled uniformly at the dispatch layer, not implemented separately by each tool.**

---

## Danger Pattern

`DangerPattern` is a matching rule in the permission system for identifying high-risk operations.

Commonly used to detect: dangerous shell commands, sensitive path operations, high-risk write actions.

It's not a complete security system, but it's the first signal source in the unified interception chain.

---

## Fallback Provider

`fallback provider` is the backup backend when model calls fail.

It handles not business semantics but runtime availability issues: primary provider rate limited, server errors, a model currently unavailable.

Core idea: **A model call failure does not equal a task failure.**

---

## Gateway

`gateway` is the multi-platform access layer.

Its job is to unify different platforms' input and output into a format Hermes internals can understand. Examples: Telegram messages, Discord messages, Slack events.

These platform differences should not pollute `AIAgent`'s main logic, so they're converged at the gateway layer.

---

## Hook

A `hook` is an insertable observation point in the lifecycle.

It allows you to: add additional logic before and after tool calls, record logs, inject audit information, append monitoring behavior.

But hooks' boundary must also be clear: **suitable for side effects, not for rewriting main loop control flow.**

---

## Subagent

A `subagent` is an agent execution unit spawned for a subtask.

Its most important value isn't "one more model call" but: giving the subtask a cleaner working context, reducing the risk of parent task context pollution, and enabling complex goals to be split by subtask.

When understanding `h15`, the key misconception to avoid is treating subagent as just "recursively calling the model."

---

## Provider Runtime

`provider runtime` is the model backend adaptation layer.

It resolves: provider name, model name, API mode, key / base_url into a truly executable call scheme.

Its value is making the upper-layer agent as unaware of model vendors as possible.

---

## MCP

`MCP` (Model Context Protocol) can be roughly understood as:

**A standardized protocol for integrating external capabilities into the agent.**

In Hermes' teaching, what's most critical about MCP isn't "external tools" but: it also gets registered as a tool, ultimately enters the unified dispatch path, and behaves as consistently as possible with native tools from the agent's perspective.

---

## Plugin

A `plugin` is the official extension interface.

Its boundary with skills must be clear:

- `skill` injects operating guides
- `plugin` registers capabilities themselves: tools, hooks, commands

So plugins are closer to "extending code capabilities"; skills are closer to "supplementing task methods."

---

## Trajectory

A `trajectory` is structured trace data from one agent run.

It may contain: input, intermediate messages, tool calls, output, success/failure labels.

In `h19`, its significance is:

**Every run has the potential to become training data, but only after filtering, cleaning, and formatting.**

---

## How to Use This Glossary

If you continue reading chapters and get confused, use this glossary as a "recalibration page":

- Don't understand a term → come back here
- Can't tell which layer a term belongs to → go back to `h00`
- Can't tell what structure a term maps to → go back to `data-structures.md`

The glossary's goal isn't to make you memorize definitions but to help you **maintain boundary awareness** throughout your reading.
