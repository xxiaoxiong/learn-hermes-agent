# h02 — Tool System: Registry Decoupling Schema from Handler

> **Core Insight**: A tool schema is the instruction manual for the model; a handler is the executor for code — separating the two is what lets you "add tools without touching the main loop."

---

## The Problem: What's Wrong with h01's Tool System?

In h01, the `_dispatch()` method looked like this:

```python
def _dispatch(self, tool_call) -> str:
    name = tool_call.function.name
    args = json.loads(tool_call.function.arguments)
    if name == "bash":
        return run_bash(args["command"])
    return f"[Unknown tool: {name}]"
```

Every new tool requires modifying the if-else chain in `_dispatch()`. Tool definitions (the `TOOLS` list) and execution logic (`_dispatch`) are scattered in two places, easy to fall out of sync.

**The deeper issue**: the main loop and the tool system are coupled together. The main loop should never change — only the tool set should.

---

## The Solution: ToolRegistry

```python
class ToolRegistry:
    def __init__(self):
        self._handlers: dict[str, Callable] = {}  # name → handler function
        self._schemas: dict[str, dict] = {}        # name → JSON Schema

    def register(self, name: str, schema: dict, handler: Callable) -> None:
        """Bind schema and handler in one call"""
        self._schemas[name] = {"type": "function", "function": schema}
        self._handlers[name] = handler

    def get_schemas(self) -> list[dict]:
        """Return all schemas (passed to the API as the tools parameter)"""
        return list(self._schemas.values())

    def dispatch(self, name: str, args: dict) -> ToolResult:
        """Execute a tool, catching all exceptions to avoid breaking the loop"""
        if name not in self._handlers:
            return ToolResult(success=False, content=f"Unknown tool: {name}")
        try:
            result = self._handlers[name](**args)
            return ToolResult(success=True, content=str(result))
        except Exception as e:
            return ToolResult(success=False, content=f"Tool execution failed: {e}")
```

---

## Key Data Structures

### ToolSchema

Each tool's JSON Schema tells the model: what the tool is called, what it does, and what parameters it needs.

```python
{
    "type": "function",
    "function": {
        "name": "read_file",
        "description": "Read the contents of a local file",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "File path"}
            },
            "required": ["path"],
        },
    },
}
```

### ToolResult

A unified wrapper for tool execution results:

```python
class ToolResult:
    def __init__(self, success: bool, content: str):
        self.success = success
        self.content = content

    def __str__(self) -> str:
        prefix = "" if self.success else "[ERROR] "
        return prefix + self.content
```

**Design point**: When a tool fails, it returns `ToolResult(success=False, ...)` instead of raising an exception. The failure message flows back to the model as a string, letting the model decide how to handle it (retry, try a different approach, or report the error).

### Dispatch Map

```
registry._schemas["read_file"] → JSON Schema (returned by get_schemas() for the API)
registry._handlers["read_file"] → _read_file function (called by dispatch())
```

Two dicts, same `name` as the key — that is the "separation" in practice.

---

## Adding a Tool: Just 3 Lines

```python
registry = build_default_registry()  # Initialize with 3 built-in tools

# ← Add a new tool; main loop code is completely untouched
registry.register(
    "get_time",
    {
        "name": "get_time",
        "description": "Return the current time in ISO format",
        "parameters": {"type": "object", "properties": {}},
    },
    lambda: datetime.datetime.now().isoformat(),
)
```

The key call in the main loop becomes:

```python
# Before (h01): hard-coded if-else
result = self._dispatch(tool_call)

# After (h02): delegate to the registry
args = json.loads(tc.function.arguments)
result = self.registry.dispatch(tc.function.name, args)
```

**Not a single line of the main loop changed** (only the implementation details of `_dispatch` moved).

---

## Mapping to Real Hermes Code

Hermes' `tools/registry.py` is nearly identical to the teaching `ToolRegistry`:

| Teaching Implementation | Hermes Source | Notes |
|---|---|---|
| `ToolRegistry` | `ToolRegistry` | Same-named class, same dispatch map |
| `registry.register()` | `registry.register()` | Same interface |
| `registry.get_schemas()` | `registry.get_schemas()` | Same interface |
| `registry.dispatch()` | `registry.dispatch()` | Hermes adds approval interception (h09) |
| `ToolResult` | `ToolResult` | Same structure |

Hermes uses a **self-registration pattern**: each tool file calls `registry.register()` at module load time, with no central summary list needed. For example:

```python
# tools/bash_tool.py (at the end)
registry.register("bash", BASH_SCHEMA, run_bash)

# tools/read_file_tool.py (at the end)
registry.register("read_file", READ_FILE_SCHEMA, read_file)
```

Simply importing these modules automatically registers the tools.

---

## Common Misconceptions

**Misconception 1**: The `description` in the schema doesn't matter  
→ `description` is the primary basis for the model to decide "when and how" to use a tool. If it's unclear, the model will misuse or skip the tool.

**Misconception 2**: Tool handlers should handle errors and raise exceptions  
→ Tool exceptions should not propagate to the main loop. The `try-except` in `registry.dispatch()` ensures all errors are converted to `[ERROR]` strings, letting the model decide.

**Misconception 3**: You need a separate class for each tool  
→ A handler is just a plain function; `**args` unpacks the JSON parameters. Classes are only warranted when a handler needs to maintain state.

---

## Hands-On Exercises

1. Run `python agents/h02_tool_system.py` and observe the three built-in tools working together
2. Add a `list_dir` tool (using `os.listdir(path)`) without modifying any `AIAgent` code
3. Deliberately make a handler raise an exception and observe how the model responds to the `[ERROR]` message
