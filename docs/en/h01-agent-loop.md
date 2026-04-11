# h01 — Agent Loop: The While-Loop Execution Engine

> **Core Insight**: An agent is not a single question-and-answer exchange — it is a continuously running loop that keeps going until the model chooses to stop calling tools.

---

## The Problem: What Happens Without a Loop?

Suppose you make a single OpenAI API call:

```python
response = client.chat.completions.create(
    model=MODEL,
    messages=[{"role": "user", "content": "List the files in the current directory"}],
    tools=TOOLS,
)
```

The model returns a `tool_call` (invoking the `bash` tool), saying it wants to run `ls`.  
**But nothing actually happens.** The model merely expressed an intent — the real execution is on your side.

If you don't send the tool result back to the model, it never learns what the command produced and cannot make the next decision.

This is why the agent loop exists.

---

## Core Mechanism: The Closed Loop of Messages

The essence of the Hermes agent loop is: **continuously append tool results to the `messages` list so the model can make decisions with full context**.

```
┌─────────────────────────────────────────────┐
│              messages list                   │
│  [user msg] → [assistant tool_call] → ...   │
│             ← [tool result] ←               │
└─────────────────────────────────────────────┘
        ↓ send to API            ↑ append back
   model response             tool execution result
```

### Turn Lifecycle (6 Steps)

```
Step 1  User message appended to messages
Step 2  Full messages sent to API → receive model response
Step 3  Append the model's output to messages (⚠️ required, or the API will error)
Step 4a If response contains tool_calls → execute each tool
Step 4b Tool results appended as role="tool" messages → back to Step 2
Step 5  If response has no tool_calls → return content, exit loop
```

---

## Key Data Structures

### The messages List

```python
messages = [
    {"role": "user", "content": "List the files in the current directory"},
    
    # Model calls a tool (appended at Step 3)
    {
        "role": "assistant",
        "tool_calls": [{
            "id": "call_abc123",
            "type": "function",
            "function": {"name": "bash", "arguments": '{"command": "ls -la"}'}
        }]
    },
    
    # Tool result (appended at Step 4b)
    {
        "role": "tool",
        "tool_call_id": "call_abc123",   # ← must match tool_call.id
        "content": "total 32\ndrwxr-xr-x ..."
    },
    
    # Model's final answer (loop ends)
    {"role": "assistant", "content": "The current directory contains the following files: ..."}
]
```

**Note**: `tool_call_id` is the pairing key between tool_call and tool_result. If the IDs don't match, the API will error.

### LoopState (Iteration Control)

```python
class AIAgent:
    def __init__(self, max_iterations: int = 10):
        self.max_iterations = max_iterations  # Budget cap: prevents infinite loops
        self.messages: list[dict] = []         # Working memory
```

`max_iterations` is a safety net. Normally, the model stops calling tools on its own when the task is complete (no more `tool_calls` returned), and the loop exits naturally.

---

## Code Walkthrough: h01_agent_loop.py

### Tool Definition (Schema)

```python
TOOLS = [{
    "type": "function",
    "function": {
        "name": "bash",
        "description": "Execute a shell command and return its output",
        "parameters": {
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "The shell command to execute"}
            },
            "required": ["command"],
        },
    },
}]
```

This is the instruction manual for the **model**. The model reads `name`, `description`, and `parameters` to decide whether to call the tool and what arguments to pass.

The `run_bash()` function is the handler for **code** execution. The two are bound by `name = "bash"`. Chapter h02 abstracts this binding into `ToolRegistry`.

### The Main Loop

```python
def run_conversation(self, user_message: str) -> str:
    self.messages.append({"role": "user", "content": user_message})

    for iteration in range(self.max_iterations):
        response = self.client.chat.completions.create(
            model=MODEL,
            messages=self.messages,
            tools=TOOLS,
        )
        message = response.choices[0].message

        # ⚠️ Critical: append this turn's output first, then branch
        self.messages.append(message.model_dump(exclude_unset=True))

        if message.tool_calls:          # Branch A: execute tools, continue loop
            for tool_call in message.tool_calls:
                result = self._dispatch(tool_call)
                self.messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": result,
                })
            continue

        return message.content or ""    # Branch B: direct answer, exit loop

    return f"[Reached max iterations {self.max_iterations}, task aborted]"
```

---

## Mapping to Real Hermes Code

| Teaching Implementation | Hermes Source | Notes |
|---|---|---|
| `AIAgent.run_conversation()` | `run_agent.py: AIAgent.run_conversation()` | Structurally identical |
| `self.messages` | `self.messages` | Same field name |
| `max_iterations` | `IterationBudget` class | Hermes is more complex: supports parent-child agent budget sharing |
| `_dispatch()` with if-else | `ToolRegistry.dispatch()` | Abstracted into a registry in h02 |
| `tool_call_id` pairing | Same mechanism | Required by the OpenAI API spec |

Hermes' `run_agent.py` adds on top of this: budget sharing, fallback providers, context compression triggers, memory flush, todo interception, and more. These are introduced one by one in subsequent chapters.

---

## Common Misconceptions

**Misconception 1**: The agent is "waiting" while "the model is thinking"  
→ When the model returns `tool_calls`, it is merely expressing intent. The real "action" happens when your code executes the tool. The loop is the agent's action mechanism.

**Misconception 2**: Empty `tool_calls` = the model made an error  
→ `tool_calls` being `None` or an empty list is normal: the model considers the task complete and gives a text answer directly — that is the exit condition.

**Misconception 3**: Messages should be reset for every conversation  
→ `messages` is the conversation history and should remain continuous within a session. Cross-session isolation is managed by `SessionDB` in h06.

---

## Hands-On Exercises

1. Run `python agents/h01_agent_loop.py` and observe the loop count and tool call process
2. Change `max_iterations` to `2`, give the agent a multi-step task, and observe the early termination output
3. Print `iteration` and `len(self.messages)` inside `run_conversation` to understand how messages grow each turn
