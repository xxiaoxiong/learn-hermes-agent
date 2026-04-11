# h07 — Memory System: Cross-Session Persistent Memory and Flush Timing

> **Core Insight**: Knowledge in context ≠ memory — if it's not written to `MEMORY.md`, it's not remembered; flush must happen before the turn ends and before compression.

---

## The Problem: How to Retain Knowledge Across Sessions?

h06's `SessionDB` can save complete conversation history, but:

- Each new conversation starts with an empty context
- The user told the agent "I prefer concise code style," but the agent forgets after restart
- After compression, knowledge scattered across messages gets diluted by the summary

**Context ≠ Memory**. True memory requires active writing to persistent files.

---

## The Solution: MEMORY.md and USER.md

Hermes uses two markdown files for cross-session memory:

```
MEMORY.md    ← Agent's record of its own work state
             (current project, tool preferences, unfinished tasks…)

USER.md      ← Agent's knowledge about the user
             (user preferences, work style, common paths…)
```

These two files are loaded in `PromptBuilder`'s `memory` section (h04's priority=20) and become part of the system prompt for every conversation.

---

## Flush Timing: Why It Matters

Incorrect flush timing can cause memory loss:

```
turn 1: User says "Remember: I prefer concise code"
         Agent decides to write to MEMORY.md
         ↓
         [If flush happens here] ✅ Memory written successfully
         ↓
         Context compression occurs
         [If flush happens here] ❌ Too late — memory content already diluted by summary
         ↓
         Turn ends
```

Hermes' flush strategy:
1. **Before turn ends**: After all tool calls in a turn complete, force flush before appending the assistant's final answer
2. **Before compression**: Before the context compressor triggers, flush all pending memory writes

---

## Deduplication Logic

MEMORY.md cannot grow without bounds. `memory_manager.py` deduplicates before writing:

```python
def write_memory(self, key: str, value: str, file: str = "MEMORY.md") -> str:
    """
    Write a memory entry:
    1. Read existing MEMORY.md
    2. Check for an existing entry with the same key (dedup)
    3. If over the character limit, remove the oldest entry
    4. Write the new entry
    5. Return the operation result
    """
    current = self._read_file(file)
    entries = self._parse_entries(current)

    # Dedup: update if same key exists, otherwise append
    existing = next((e for e in entries if e["key"] == key), None)
    if existing:
        existing["value"] = value
        existing["updated_at"] = datetime.now().isoformat()
    else:
        entries.append({"key": key, "value": value, "updated_at": ...})

    # Character limit control (default 10,000 characters)
    while self._total_chars(entries) > self.char_limit:
        entries.pop(0)  # Remove the oldest entry

    self._write_file(file, self._format_entries(entries))
    return f"Memory written: {key}"
```

---

## Memory Tool Schema

```python
MEMORY_TOOL_SCHEMA = {
    "name": "memory_write",
    "description": "Persistently save important information, available across sessions",
    "parameters": {
        "type": "object",
        "properties": {
            "key": {"type": "string", "description": "Identifier for the memory"},
            "value": {"type": "string", "description": "Content to remember"},
            "file": {
                "type": "string",
                "enum": ["MEMORY.md", "USER.md"],
                "description": "Which file to write: MEMORY.md (work memory) or USER.md (user info)",
            },
        },
        "required": ["key", "value"],
    },
}
```

`memory_write` is an agent-level tool (the concept from h03): it is intercepted by the main loop before `ToolRegistry.dispatch()` and directly calls `memory_manager.write_memory()`.

---

## Decision Tree: Temporary Context vs Persistent Memory

```
Does this information need to persist across sessions?
├── Yes → Write to MEMORY.md or USER.md
│        Is it about the user? → USER.md
│        Is it about work state? → MEMORY.md
└── No  → Leave it in the messages context
         (It naturally disappears when the session ends)
```

---

## Code Walkthrough: snippets/h07_memory_system.py

The Code tab for this chapter shows curated snippets from Hermes' `agent/memory_manager.py` and `tools/memory_tool.py`, focusing on:

1. **`MemoryManager.flush()`** — Batch flush of all pending entries
2. **Deduplication algorithm** — Update on same key, evict oldest on overflow
3. **`memory_write` handler** — How it's wrapped as an agent-level tool

---

## Common Misconceptions

**Misconception 1**: Write everything to MEMORY.md  
→ Memory should be the essence, not a log. The character limit (10,000) automatically removes the oldest entries; writing too much pushes important information out.

**Misconception 2**: MEMORY.md content doesn't affect the current conversation  
→ MEMORY.md is read during every `build_system_prompt()` call and injected into the system prompt's memory section. After writing to MEMORY.md, the **next** conversation can use it.

**Misconception 3**: Flush can be done once at the end of the session  
→ If the process crashes before the session ends, all pending memory is lost. Hermes flushes at the turn level; in the worst case, only the current turn's memory is lost.
