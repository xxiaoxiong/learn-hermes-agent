# h05 — Context Compression: Preflight Trigger + Middle-Turn Summaries + Lineage Tracking

> **Core Insight**: Compression is not deletion — "summarize the middle, keep the latest N" is the correct approach; `lineage_id` ensures the lineage remains traceable.

---

## The Problem: Context Keeps Growing

Every tool call adds several messages to the list. After running for a while:

- **Exceeds the model's context window**: API errors with `context length exceeded`
- **Token costs explode**: Each API call sends the full history; cost scales linearly with message count
- **Model attention scatters**: Excessively long history dilutes the impact of key information

---

## The Wrong Approach: Truncation

```python
# ❌ Keep only the last N messages — loses the middle process
messages = messages[-20:]
```

Problems:
1. May sever `tool_call` and its corresponding `tool_result` pair, causing API errors
2. Everything that happened in the middle is completely lost; the model has no reference

---

## The Right Approach: Middle-Turn Summaries

```
Original messages (40 items):
  [user][assistant][tool][tool_result]    ← turn 1
  [assistant][tool][tool_result]          ← turn 2 (tool_call + result pair, cannot split)
  ...
  [assistant][tool][tool_result]          ← turn 38

Compressed messages (12 items):
  [user: "Task summary: In turns 1-35, the agent..."]  ← summary block (new)
  [assistant][tool][tool_result]          ← turn 36 (kept)
  [assistant][tool][tool_result]          ← turn 37 (kept)
  [assistant content]                     ← turn 38 (kept, protect_last_n=5)
```

Key rules:
1. **Never split tool_call/result pairs**: `[assistant tool_call]` and the corresponding `[tool: tool_call_id]` must be kept or compressed as a pair
2. **Keep the latest N**: `protect_last_n` messages are not compressed, preserving recent working context
3. **Summarize the middle**: Call the same LLM to generate a summary

---

## Key Data Structures

### CompressionPolicy

```python
@dataclass
class CompressionPolicy:
    threshold_pct: float = 0.50  # Trigger compression when token usage exceeds 50%
    protect_last_n: int = 5      # Latest N messages are not compressed
    max_context_tokens: int = 100_000  # Model context window size
```

### SummaryBlock

The summary message inserted into messages after compression:

```python
{
    "role": "user",
    "content": f"[Context Summary] The following is a summary of the previous conversation:\n\n{summary_text}",
    "_is_summary": True,  # Marked as a summary block for later identification
}
```

### lineage_id

```python
import uuid

class ContextCompressor:
    def compress(self, messages, session_id):
        # ...perform compression...
        new_lineage_id = str(uuid.uuid4())
        # New session records parent_session_id = session_id
        return compressed_messages, {
            "lineage_id": new_lineage_id,
            "parent_session_id": session_id,
        }
```

---

## Preflight Check Mechanism

Before each API call, estimate the current token usage:

```python
def needs_compression(self, messages: list[dict]) -> bool:
    """Simplified estimation: character count / 4 ≈ token count (English ~4 chars/token)"""
    estimated_tokens = sum(
        len(str(m.get("content", ""))) // 4
        for m in messages
    )
    usage_pct = estimated_tokens / self.policy.max_context_tokens
    return usage_pct >= self.policy.threshold_pct
```

Hermes has two trigger points:
- **preflight (50%)**: Checked before each API call, proactive trigger
- **gateway auto (85%)**: Gateway layer force-triggers when context approaches capacity

---

## tool_call / result Pairs Must Not Be Split

This is the most important implementation detail:

```python
def _collect_pairs(self, messages):
    """Parse messages into turn pairs, ensuring tool_call and result are handled together"""
    pairs = []
    i = 0
    while i < len(messages):
        msg = messages[i]
        if msg.get("role") == "assistant" and msg.get("tool_calls"):
            # Collect all following tool results
            results = []
            j = i + 1
            while j < len(messages) and messages[j].get("role") == "tool":
                results.append(messages[j])
                j += 1
            pairs.append({"call": msg, "results": results})
            i = j
        else:
            pairs.append({"call": msg, "results": []})
            i += 1
    return pairs
```

During compression, the last `protect_last_n` complete pairs are kept, and a summary is generated for the preceding pairs.

---

## The Significance of lineage_id

Compression creates a **new session**, not an overwrite of the original:

```
session-001 (original, 40 messages)
    ↓ compression
session-002 (compressed, 12 messages, parent_session_id = "session-001")
    ↓ compress again
session-003 (parent_session_id = "session-002")
```

This way:
- The original complete history always exists (in SQLite)
- FTS5 full-text search can search across all lineage nodes
- Any historical version can be traced via the `parent_session_id` chain

---

## Mapping to Real Hermes Code

| Teaching Implementation | Hermes Source | Notes |
|---|---|---|
| `CompressionPolicy` | `CompressionPolicy` | Fields and semantics are identical |
| `ContextCompressor.compress()` | `ContextCompressor.compress()` | Same logic, Hermes version is more robust |
| `protect_last_n` | `protect_last_n` | Same parameter |
| `lineage_id` | `lineage_id` | Core tracking field for sessions in Hermes |
| preflight 50% | preflight 50% + gateway 85% | Hermes has two trigger mechanisms |

---

## Common Misconceptions

**Misconception 1**: Compression = deleting the oldest messages  
→ Deleting messages breaks tool_call/result pairs and causes API errors. The correct approach is to replace middle turns with a summary.

**Misconception 2**: Keeping more messages is always better  
→ Exceeding the context window causes errors; approaching it drives API costs up sharply; model attention scatters. A reasonable `protect_last_n` (e.g., 5–10) is usually sufficient.

**Misconception 3**: lineage_id is just a random ID  
→ It is the core of the session lineage chain. Together with SQLite's `parent_session_id` field, it enables the key capability of "tracing history even after compression."

---

## Hands-On Exercises

1. Run `python agents/h05_context_compression.py` and observe the change in message count before and after compression
2. Set `protect_last_n = 2` and observe which messages are kept
3. Print `lineage_id` and understand how it connects the two sessions before and after compression
