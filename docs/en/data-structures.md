# Data Structures (Core Data Structure Quick Reference)

> When learning Hermes Agent, the easiest place to get lost isn't too many features — it's not knowing "where state actually lives." This document consolidates key data structures that repeatedly appear across the main chapters into a single state map, helping you piece 19 chapters back into a coherent whole.

---

## How to Read This Document

Use it as a "state index page" rather than memorizing from top to bottom:

- If you don't understand a term → go to [`glossary.md`](./glossary.md)
- If chapter boundaries are unclear → go to [`h00-architecture-overview.md`](./h00-architecture-overview.md)
- If you're confused between `h05` / `h06` / `h07` → focus on the "context, session, memory" structure groups
- If you're confused between `h08` / `h17` / `h18` → focus on the "skill, tool registry, plugin, MCP" structure groups

---

## Two General Principles to Remember First

### Principle 1: Distinguish "Content State" from "Process State"

- `messages`, memory text, skill text → content state
- `turn_count`, todo status, permission decision, fallback chain → process state

Many beginners mix these two, making it hard to understand why an agent system needs both message history and control state.

### Principle 2: Distinguish "Persistent State" from "Runtime State"

- session, memory files, cron jobs, persisted configs → persistent state
- current tool call, current approval result, current provider fallback choice → runtime state

Once this boundary is clear, many "why isn't this just put inside messages" questions answer themselves.

---

## 1. Conversation Main Line Structures

### Message

Purpose: Store a single conversation message.

Minimal shape:

```python
message = {
    "role": "user" | "assistant" | "tool",
    "content": "...",
}
```

In more complete agent loops, it may also contain: structured text blocks, tool call info, tool result info.

Related chapters: `h01`, `h02`, `h05`, `h06`

### Messages

Purpose: Store the message list currently within the context window during the conversation.

Minimal shape:

```python
messages = [message1, message2, message3]
```

It's the agent's most important current working memory, but not a long-term archive.

Related chapters: `h01`, `h05`, `h06`

### ToolCall

Purpose: Describe which tool the model wants to call and with what parameters.

Minimal shape:

```python
tool_call = {
    "id": "call_123",
    "name": "read_file",
    "arguments": {"path": "notes.txt"},
}
```

Its significance is turning "the model's intent" into "a structure code can dispatch."

Related chapters: `h01`, `h02`

### ToolResult

Purpose: Write tool execution results back into the conversation main line.

Minimal shape:

```python
tool_result = {
    "role": "tool",
    "tool_call_id": "call_123",
    "content": "file content...",
}
```

Its key role isn't for the user to see but for the model to continue thinking based on real execution results in the next turn.

Related chapters: `h01`, `h02`

### LoopState

Purpose: Record where the main loop is currently at.

Minimal shape:

```python
loop_state = {
    "iteration": 3,
    "max_iterations": 12,
    "stopped": False,
}
```

It's process state, not business content.

Related chapters: `h01`

---

## 2. Tool System Structures

### ToolSchema

Purpose: Tell the model what this tool is called, what it does, and what input it needs.

Minimal shape:

```python
tool_schema = {
    "name": "write_file",
    "description": "Write text to a file",
    "parameters": {
        "type": "object",
        "properties": {
            "path": {"type": "string"},
            "content": {"type": "string"},
        },
    },
}
```

It's the instruction manual for the model, not code for the handler to directly execute.

Related chapters: `h02`

### ToolHandler

Purpose: The code entry point that actually executes tool logic.

Minimal shape:

```python
def write_file(path: str, content: str) -> str:
    ...
```

Once separated from schema, the tool system becomes easy to extend.

Related chapters: `h02`

### ToolRegistry

Purpose: Centrally register schemas and handlers, dispatching by tool name.

Minimal shape:

```python
registry = {
    "write_file": {
        "schema": tool_schema,
        "handler": write_file,
    }
}
```

Real value: new tools register once; the main loop doesn't need to change.

Related chapters: `h02`, `h17`, `h18`

### Dispatch Map

Purpose: Route tool requests to the corresponding handler by name.

Minimal shape:

```python
dispatch_map = {
    "read_file": read_file,
    "write_file": write_file,
    "bash": run_command,
}
```

Think of it as the registry's core execution surface.

Related chapters: `h02`

---

## 3. Planning and Execution State

### TodoItem

Purpose: Describe a single step in the plan.

Minimal shape:

```python
todo_item = {
    "id": "todo_1",
    "content": "Inspect bridge-docs metadata",
    "status": "in_progress",
}
```

It gives the agent explicit representation of its own work progress.

Related chapters: `h03`

### PlanState

Purpose: Store the currently active todo list.

Minimal shape:

```python
plan_state = {
    "items": [todo_item1, todo_item2],
}
```

Key point: it's agent internal execution state, not a normal external tool result.

Related chapters: `h03`

### Agent-level Tool State

Purpose: Store internal state changes that must be prioritized by the main loop.

Minimal shape:

```python
agent_state = {
    "plan_state": plan_state,
}
```

Its existence explains why `todo` isn't a normal registry tool.

Related chapters: `h03`

---

## 4. Prompt Assembly Structures

### PromptSection

Purpose: Represent an independently manageable fragment of the system prompt.

Minimal shape:

```python
section = {
    "name": "memory",
    "content": "...",
    "priority": 30,
    "enabled": True,
}
```

Its value: prompts are no longer one hard-to-maintain large string.

Related chapters: `h04`

### PromptBuilder

Purpose: Assemble multiple prompt sections by order and conditions.

Minimal shape:

```python
builder = {
    "sections": [section1, section2, section3],
}
```

It gives prompt structure clear boundaries and priorities.

Related chapters: `h04`

### PromptSources

Purpose: Represent where prompt fragments come from.

Most typical sources: personality, memory, skills, context files, tool guidance.

This isn't a fixed class name but a categorization perspective for understanding prompt structure.

Related chapters: `h04`, `h07`, `h08`

---

## 5. Context Compression Structures

### CompressionPolicy

Purpose: Decide when to trigger compression and which messages to protect.

Minimal shape:

```python
policy = {
    "threshold": 0.5,
    "protect_last_n": 8,
}
```

Related chapters: `h05`

### SummaryBlock

Purpose: Replace a segment of earlier raw history with a summary.

Minimal shape:

```python
summary_block = {
    "compressed_turn_ids": [1, 2, 3, 4],
    "summary_text": "Earlier turns established the file layout...",
}
```

It's the core embodiment of "compression is not deleting history."

Related chapters: `h05`

### CompressionResult

Purpose: Represent the new context result after one compression.

Minimal shape:

```python
compression_result = {
    "messages": [...],
    "summary": summary_block,
    "lineage_id": "session_b",
}
```

It typically affects: the currently visible context, session lineage, and subsequent search paths.

Related chapters: `h05`, `h06`

---

## 6. Session Persistence Structures

### SessionRecord

Purpose: Store a persistent record of one session.

Minimal shape:

```python
session_record = {
    "session_id": "sess_123",
    "platform": "cli",
    "messages": [...],
    "created_at": "2026-04-10T10:00:00Z",
}
```

This is the critical bridge from "runtime message list" to "recoverable session record."

Related chapters: `h06`

### SessionLineage

Purpose: Represent parent-child relationships between sessions.

Minimal shape:

```python
session_lineage = {
    "session_id": "sess_new",
    "parent_session_id": "sess_old",
}
```

It lets compressed sessions still trace back to original history.

Related chapters: `h05`, `h06`

### FTS Index Record

Purpose: Support keyword search across historical sessions.

Minimal shape:

```python
fts_record = {
    "session_id": "sess_123",
    "search_text": "tool registry write file prompt builder",
}
```

Not a structure users see directly, but the foundation that makes session search work.

Related chapters: `h06`

---

## 7. Memory and Skill Structures

### MemoryEntry

Purpose: Represent a piece of information worth retaining across sessions.

Minimal shape:

```python
memory_entry = {
    "category": "user_preference",
    "content": "User prefers concise summaries.",
}
```

Hermes' key isn't "can write memory" but "must first judge what's worth writing."

Related chapters: `h07`

### MemoryStore

Purpose: Store long-term memory text, e.g., `MEMORY.md` / `USER.md`.

Minimal shape:

```python
memory_store = {
    "memory_md": "...",
    "user_md": "...",
}
```

Its difference from session: session leans toward history records; memory leans toward refined long-term knowledge.

Related chapters: `h07`

### SkillDescriptor

Purpose: Describe a skill's metadata and body.

Minimal shape:

```python
skill = {
    "name": "code-review",
    "description": "Guide for reviewing patches",
    "content": "...markdown body...",
}
```

Related chapters: `h08`

### SkillInjection

Purpose: Represent how a skill is injected into the current conversation.

Minimal shape:

```python
skill_injection = {
    "role": "user",
    "content": "Apply the following skill...",
}
```

Key point: it's a user message, not a system prompt section.

Related chapters: `h08`

---

## 8. Approval and Recovery Structures

### DangerPattern

Purpose: Describe a matching rule for high-risk operations.

Minimal shape:

```python
danger_pattern = {
    "pattern": r"rm\s+-rf",
    "reason": "destructive command",
}
```

Related chapters: `h09`

### ApprovalDecision

Purpose: Represent an approval result for a tool call.

Minimal shape:

```python
approval_decision = {
    "action": "allow" | "deny" | "ask",
    "reason": "matched allowlist",
}
```

This structure's value is extracting safety judgment from inside tools into a unified decision layer.

Related chapters: `h09`

### FallbackChain

Purpose: Represent the backup call order for providers / models.

Minimal shape:

```python
fallback_chain = {
    "primary": "provider_a/model_x",
    "fallbacks": ["provider_b/model_y", "provider_c/model_z"],
}
```

Related chapters: `h10`, `h16`

### ContinuationReason

Purpose: Explain why the main loop should continue after a failure.

Minimal shape:

```python
continuation_reason = {
    "reason": "fallback_provider_retry",
}
```

It makes the error recovery chain more explainable, rather than relying on implicit branching to continue execution.

Related chapters: `h10`

---

## 9. Multi-platform and Extension Structures

### CommandDef

Purpose: Describe a slash command's central registration info.

Minimal shape:

```python
command_def = {
    "name": "/skills",
    "description": "List available skills",
    "handler": list_skills,
}
```

Its significance: "one definition, reused across endpoints."

Related chapters: `h11`

### MessageEvent

Purpose: Standardize different platform inputs into a unified event object.

Minimal shape:

```python
message_event = {
    "platform": "telegram",
    "user_id": "u123",
    "text": "summarize yesterday's work",
}
```

It's the important boundary object between the gateway layer and the agent layer.

Related chapters: `h12`

### CronJob

Purpose: Describe a scheduled task configuration.

Minimal shape:

```python
cron_job = {
    "id": "job_daily_summary",
    "schedule": "0 9 * * *",
    "prompt": "summarize overnight alerts",
    "skill_attachment": "ops-summary",
}
```

Related chapters: `h13`

### HookEvent

Purpose: Describe a single event in the hook lifecycle.

Minimal shape:

```python
hook_event = {
    "stage": "post_tool_call",
    "tool_name": "write_file",
    "payload": {...},
}
```

Suitable for observation and side effects; not suitable for taking over the main control flow.

Related chapters: `h14`

### DelegationRequest

Purpose: Represent a subtask delegation from parent agent to child agent.

Minimal shape:

```python
delegation_request = {
    "task": "analyze provider fallback behavior",
    "shared_budget": 6,
}
```

Related chapters: `h15`

### ProviderConfig

Purpose: Describe a model provider's call configuration.

Minimal shape:

```python
provider_config = {
    "provider": "openrouter",
    "model": "anthropic/claude-3-5-sonnet",
    "base_url": "https://openrouter.ai/api/v1",
    "api_mode": "openai-compatible",
}
```

Related chapters: `h16`

### MCPToolDescriptor

Purpose: Describe a tool dynamically discovered from an MCP server.

Minimal shape:

```python
mcp_tool = {
    "server": "filesystem",
    "name": "read_text",
    "schema": {...},
}
```

Key point: it ultimately enters the unified registry too.

Related chapters: `h17`

### PluginContext

Purpose: Provide the official interface for plugins to register tools, hooks, commands, etc.

Minimal shape:

```python
plugin_context = {
    "register_tool": ...,
    "register_hook": ...,
    "register_command": ...,
}
```

Related chapters: `h18`

### TrajectoryRecord

Purpose: Represent a training trajectory extracted from one agent run.

Minimal shape:

```python
trajectory = {
    "input": "...",
    "messages": [...],
    "output": "...",
    "label": "successful",
}
```

Related chapters: `h19`

---

## How to Use This Structure Reference

If you get confused while reading a chapter, first ask yourself three questions:

1. Am I looking at content state or process state?
2. Is it temporary at runtime or does it need persistence?
3. Does it belong to the main loop, the extension control plane, or the outer platform layer?

As long as you can answer these three questions, your understanding of Hermes usually won't fall apart.
