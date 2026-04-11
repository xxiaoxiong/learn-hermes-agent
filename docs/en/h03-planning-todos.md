# h03 — Planning & Todos: Agent-Level Tool Interception + Task State Tracking

> **Core Insight**: todo is not a normal tool — it mutates the agent's own execution state and is intercepted by the main loop **before** ToolRegistry dispatch.

---

## The Problem: Agents Get Lost on Complex Tasks

Give the h02 agent a multi-step task:

> "Help me: 1. Check the Python version, 2. List files in the current directory, 3. Count .py files, 4. Write a summary report to report.txt"

Without a todo tool, the agent might:
- Forget remaining steps halfway through
- Repeat a step it already completed
- Lose track of overall progress after finishing

Humans write TODO lists for complex tasks. Agents should have this ability too.

---

## Key Concept: Agent-Level Tool Interception

The fundamental difference between `todo` and tools like `read_file` or `bash`:

| | Normal tools (bash, read_file…) | Agent-level tool (todo) |
|---|---|---|
| Target | External systems (OS, files, network) | Agent's own state (PlanState) |
| Handling location | `ToolRegistry.dispatch()` | Main loop intercepts **before** `dispatch()` |
| Failure impact | Returns `[ERROR]` string to the model | Affects the agent's self-awareness of progress |

Hermes' `run_agent.py` checks whether a tool name is `todo` (or another agent-level tool like `session_search` or `memory_write`) before calling `registry.dispatch()`.

```python
# Interception logic in the main loop (simplified)
for tool_call in message.tool_calls:
    name = tool_call.function.name
    args = json.loads(tool_call.function.arguments)

    # ← agent-level tools are intercepted first
    if name == "todo":
        result = self._handle_todo(args)
    else:
        # Normal tools go through the registry
        result = self.registry.dispatch(name, args)
```

---

## Key Data Structures

### TodoItem

```python
from dataclasses import dataclass, field
from enum import Enum

class TodoStatus(Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    DONE = "done"

@dataclass
class TodoItem:
    id: str
    description: str
    status: TodoStatus = TodoStatus.PENDING
```

### PlanState

```python
@dataclass
class PlanState:
    todos: list[TodoItem] = field(default_factory=list)
    _id_counter: int = 0

    def create(self, description: str) -> TodoItem: ...
    def update(self, todo_id: str, status: TodoStatus) -> str: ...
    def complete(self, todo_id: str) -> str: ...
    def list_all(self) -> str: ...
```

**Key point**: `PlanState` lives on the `AIAgent` instance (`self.plan = PlanState()`), not inside messages or in a database. This means:

- Compressing messages does not lose the todo list
- Multiple turns within the same agent instance share the same PlanState
- Cross-session recovery requires separate handling (Hermes persists to SQLite)

---

## The Four Operations

```python
# Actions supported by the todo tool
{
    "action": "create",   "description": "Check Python version"
}
{
    "action": "update",   "id": "todo-1", "status": "in_progress"
}
{
    "action": "complete", "id": "todo-1"
}
{
    "action": "list"
}
```

Corresponding schema design:

```python
TODO_SCHEMA = {
    "name": "todo",
    "description": "Manage a task list to track execution progress",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["create", "update", "complete", "list"],
            },
            "description": {"type": "string"},
            "id": {"type": "string"},
            "status": {
                "type": "string",
                "enum": ["pending", "in_progress", "done"],
            },
        },
        "required": ["action"],
    },
}
```

---

## Declaring the todo Tool in the System Prompt

```python
SYSTEM_PROMPT = """You are an AI assistant.

For complex tasks, follow this process:
1. Use the todo tool to create a task list and break down the goal
2. Execute step by step, marking each as in_progress when you start
3. Mark each as done when complete
4. Use todo list at any time to check overall progress"""
```

This prompt tells the model when and how to use the todo tool. The model does not automatically know to do this — that is the system prompt's responsibility.

---

## Mapping to Real Hermes Code

Hermes' todo tool is actually more complex:

| Teaching Implementation | Hermes Source | Difference |
|---|---|---|
| `PlanState` (in-memory) | `hermes_state.py` todo table (SQLite) | Hermes persists to the database |
| 4 operations | Same 4 operations | Interface is identical |
| Main loop interception | `run_agent.py` agent-level check | Same pattern |

Hermes also has other agent-level tools:
- `session_search`: search past sessions (h06)
- `memory_write`: write to persistent memory (h07)

All of these are intercepted by the main loop before `ToolRegistry.dispatch()`.

---

## Common Misconceptions

**Misconception 1**: todo can be registered in ToolRegistry like any other tool  
→ You could register it, but if the handling logic lives in the handler instead of the main loop, the agent's PlanState becomes an external service and loses its "self-awareness" capability. Hermes' design: intercept in the main loop, state on the agent instance.

**Misconception 2**: The model will use the todo tool automatically  
→ It won't. You must explicitly describe when to use it and the task-decomposition process in the system prompt.

**Misconception 3**: PlanState gets compressed along with messages  
→ PlanState lives on the agent instance, so message compression does not affect it. This is deliberate: task tracking state should be more durable than conversation content.

---

## Hands-On Exercises

1. Run `python agents/h03_planning_todos.py`, give the agent a 3–4 step task, and observe the timing of todo creation and updates
2. Print the current todo list inside `_handle_todo()` and observe how state changes after each tool call
3. Remove the todo usage instructions from the system prompt and observe whether the model still uses the todo tool spontaneously
