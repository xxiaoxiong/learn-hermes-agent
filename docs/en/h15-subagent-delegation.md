# h15 — Subagent Delegation: IterationBudget Sharing and Context Isolation

> **Core Insight**: The key to subagents is clean context, not independent API calls — context isolation is the core of delegation.

---

## The Problem: When Do You Need a Subagent?

When a complex task can be decomposed into **concurrently executable** subtasks, or when a subtask needs an **isolated working context**.

For example:
- Analyze 3 codebases simultaneously, each handled independently
- Delegate "write documentation" to a subagent while the main agent continues other work
- A subtask needs its own tool_calls history (to avoid polluting the main agent's context)

The key value of subagents: **clean context**. Not "parallel API calls" (async is enough for that), but "the subtask has its own messages space."

---

## delegate_tool: Subagent Spawn Interface

```python
DELEGATE_SCHEMA = {
    "name": "delegate",
    "description": "Delegate a subtask to a subagent for independent execution",
    "parameters": {
        "type": "object",
        "properties": {
            "task": {
                "type": "string",
                "description": "Task description for the subagent to complete",
            },
            "context": {
                "type": "string",
                "description": "Initial context to provide to the subagent (optional)",
            },
        },
        "required": ["task"],
    },
}
```

---

## IterationBudget: Shared Across Parent and Child

```python
import threading
from dataclasses import dataclass

@dataclass
class IterationBudget:
    """
    Iteration budget shared between parent and child agents.
    Iterations consumed by the child count against the parent's budget.
    Ensures the total iterations across the entire task tree don't exceed the limit.
    """
    _lock: threading.Lock
    _remaining: int
    _total: int

    @classmethod
    def create(cls, total: int = 100) -> "IterationBudget":
        return cls(_lock=threading.Lock(), _remaining=total, _total=total)

    def consume(self, n: int = 1) -> bool:
        """Consume n iterations; returns whether budget remains"""
        with self._lock:
            if self._remaining <= 0:
                return False
            self._remaining -= n
            return True

    @property
    def remaining(self) -> int:
        with self._lock:
            return self._remaining
```

The parent agent passes its `budget` object to the child:

```python
class AIAgent:
    def __init__(self, budget: IterationBudget | None = None):
        self.budget = budget or IterationBudget.create(total=50)

    def _spawn_subagent(self, task: str, context: str = "") -> str:
        """Create a subagent sharing the parent's budget"""
        sub_agent = AIAgent(budget=self.budget)  # ← Shares the same budget object
        sub_agent.messages = []  # ← Clean messages (isolation)
        if context:
            sub_agent.messages.append({"role": "user", "content": context})
        return sub_agent.run_conversation(task)
```

---

## ThreadPoolExecutor: Concurrent Execution of Multiple Subagents

```python
from concurrent.futures import ThreadPoolExecutor, as_completed

def _handle_delegate(self, tool_calls: list[dict]) -> list[str]:
    """
    Execute multiple delegate calls concurrently; results are backfilled in original order.
    """
    futures = {}
    results = [""] * len(tool_calls)

    with ThreadPoolExecutor(max_workers=4) as executor:
        for i, tc in enumerate(tool_calls):
            args = json.loads(tc["function"]["arguments"])
            future = executor.submit(
                self._spawn_subagent,
                task=args["task"],
                context=args.get("context", ""),
            )
            futures[future] = i

        for future in as_completed(futures):
            idx = futures[future]
            try:
                results[idx] = future.result()
            except Exception as e:
                results[idx] = f"[Subagent execution failed: {e}]"

    return results
```

**Results are backfilled in original order**: Execution is concurrent, but tool_result order in messages matches the tool_call order.

---

## How Context Isolation Works

```
Parent agent messages:
  [user: "Analyze these three codebases: A, B, C"]
  [assistant: tool_calls=[delegate(A), delegate(B), delegate(C)]]
  [tool: subagent's full analysis of A]   ← summary, not the subagent's full messages
  [tool: subagent's full analysis of B]
  [tool: subagent's full analysis of C]

Subagent A's messages (independent):
  [user: "Analyze codebase A"]
  [assistant: tool_call=read_file("A/main.py")]
  [tool: <A/main.py contents>]
  [assistant: analysis result]
```

The subagent's messages do not pollute the parent agent's context. The parent only sees the subagent's final output (summary).

---

## Code Walkthrough: snippets/h15_subagent.py

The Code tab for this chapter shows curated snippets from `tools/delegate_tool.py`, focusing on:

1. **`IterationBudget.consume()`** — Thread-safe budget consumption
2. **`_spawn_subagent()`** — Fresh messages + shared budget
3. **`ThreadPoolExecutor` concurrency** — Future → ordered backfill

---

## Common Misconceptions

**Misconception 1**: A subagent should have its own independent IterationBudget  
→ The budget must be shared; otherwise, a single task could amplify iteration count infinitely through N layers of subagents. Shared budget is the key to preventing resource abuse.

**Misconception 2**: The main value of subagents is parallel API calls  
→ Parallelism is a side benefit. The core value is context isolation: subtasks get a clean messages space, unaffected by the parent agent's history, producing more accurate results.

**Misconception 3**: A subagent failure should abort the entire task  
→ Subagent exceptions are wrapped as `[Subagent execution failed: ...]` tool_result; the parent agent can decide how to handle it (retry, skip, or report).
