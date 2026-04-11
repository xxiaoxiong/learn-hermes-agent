# h14 — Hook System: Extending Agent Behavior Without Modifying the Main Loop

> **Core Insight**: Hooks can only observe and annotate, not replace the main loop's control flow — this is the design boundary for plugin extensibility.

---

## The Problem: How to Add New Behavior Without Modifying the Main Loop?

Use cases:
- Log every tool call
- Track token consumption per API call
- Trigger notifications after specific tools execute
- Let plugins preprocess incoming messages

If every requirement modifies `run_agent.py`, the main loop becomes bloated and mixes unrelated concerns.

---

## The Solution: HookEvent Lifecycle

```python
from enum import Enum

class HookEvent(str, Enum):
    PRE_TOOL_CALL   = "pre_tool_call"    # Before a tool call
    POST_TOOL_CALL  = "post_tool_call"   # After a tool call (result available)
    ON_MESSAGE      = "on_message"       # When a user message is received
    ON_RESPONSE     = "on_response"      # When the model gives a final reply
    ON_ERROR        = "on_error"         # When an error occurs
    PRE_COMPRESS    = "pre_compress"     # Before context compression
    POST_COMPRESS   = "post_compress"    # After context compression
```

At each event point, all registered handlers execute in order:

```
Main loop executes tool_call
    ↓ Trigger PRE_TOOL_CALL hooks
        → builtin_hook_1(event_data)  # Built-in: record tool_call start time
        → plugin_hook_A(event_data)   # Hook registered by plugin A
    ↓ Actually execute the tool
    ↓ Trigger POST_TOOL_CALL hooks
        → builtin_hook_2(event_data)  # Built-in: record elapsed time
        → plugin_hook_A(event_data)   # Plugin A's post-processing
```

---

## HookManager: Registration and Firing

```python
from typing import Callable, Any

HookHandler = Callable[[dict], None]  # Receives event_data, no return value

class HookManager:
    def __init__(self):
        self._hooks: dict[HookEvent, list[HookHandler]] = {
            event: [] for event in HookEvent
        }

    def register(self, event: HookEvent, handler: HookHandler) -> None:
        """Register a hook handler"""
        self._hooks[event].append(handler)

    def fire(self, event: HookEvent, **event_data) -> None:
        """
        Trigger all handlers registered for this event.
        Hook handler exceptions must NOT propagate to the main loop!
        """
        for handler in self._hooks[event]:
            try:
                handler(event_data)
            except Exception as e:
                print(f"[Hook Error] {event.value}: {e}")  # Silently handle
```

**Key**: `fire()` wraps each handler in `try-except`; hook exceptions never interrupt the main loop.

---

## Built-in Hooks: Always Registered

```python
def register_builtin_hooks(manager: HookManager) -> None:
    """Built-in hooks, independent of any plugin, always active"""

    # Tool call timing statistics
    call_times: dict[str, float] = {}

    def on_pre_tool_call(data: dict) -> None:
        call_times[data["tool_call_id"]] = time.time()

    def on_post_tool_call(data: dict) -> None:
        start = call_times.pop(data["tool_call_id"], None)
        if start:
            elapsed = time.time() - start
            data["elapsed_ms"] = int(elapsed * 1000)

    manager.register(HookEvent.PRE_TOOL_CALL, on_pre_tool_call)
    manager.register(HookEvent.POST_TOOL_CALL, on_post_tool_call)
```

---

## Triggering Hooks in the Main Loop

```python
# run_agent.py (with hook triggering added)

for tool_call in message.tool_calls:
    name = tool_call.function.name
    args = json.loads(tool_call.function.arguments)

    # Trigger PRE_TOOL_CALL
    self.hooks.fire(
        HookEvent.PRE_TOOL_CALL,
        tool_name=name,
        tool_call_id=tool_call.id,
        args=args,
    )

    # Actually execute the tool
    result = self.registry.dispatch(name, args)

    # Trigger POST_TOOL_CALL
    self.hooks.fire(
        HookEvent.POST_TOOL_CALL,
        tool_name=name,
        tool_call_id=tool_call.id,
        result=str(result),
    )
```

---

## The Boundary of Hooks: Observe but Don't Control

Hook handlers receive `event_data` as read-only (or can append fields), but **cannot**:
- Interrupt the main loop (no return value mechanism)
- Modify a tool_call's execution parameters
- Replace a tool's execution logic

This is an intentional design constraint. If you need control flow (like intercepting dangerous operations), use `ApprovalGate` (h09), not hooks.

---

## Plugins Register Hooks via PluginContext

```python
# Plugin code (h18 covers this in detail)
class MyPlugin:
    def setup(self, ctx: PluginContext) -> None:
        ctx.register_hook(HookEvent.POST_TOOL_CALL, self.on_tool_done)

    def on_tool_done(self, data: dict) -> None:
        print(f"✅ {data['tool_name']} done, took {data.get('elapsed_ms', '?')}ms")
```

---

## Code Walkthrough: snippets/h14_hooks_system.py

The Code tab for this chapter shows curated snippets from `gateway/hooks.py`, focusing on:

1. **`HookEvent` enum** — The complete lifecycle event list
2. **`HookManager.fire()`** — Silent exception handling to keep the main loop safe
3. **`register_builtin_hooks()`** — Implementation of built-in timing statistics

---

## Common Misconceptions

**Misconception 1**: Hooks can modify a tool's execution result  
→ They cannot. `POST_TOOL_CALL`'s `event_data` is a read-only snapshot; modifying it does not affect the tool_result already appended to messages.

**Misconception 2**: A hook exception will crash the agent  
→ It won't. `fire()` catches all hook exceptions and logs them; the main loop continues. This protects agent stability.

**Misconception 3**: Both hooks and approval (h09) can intercept tools  
→ Approval makes a yes/no decision **before** tool execution; hooks observe and annotate **before and after** execution. Their responsibilities are different and not interchangeable.
