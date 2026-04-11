# h18 — Plugin System: Extending Hermes Without Forking the Code

> **Core Insight**: A plugin is not a skill — plugins register tools and hooks, skills inject operating guides; the boundary is clear and they are not interchangeable.

---

## The Problem: How to Let Users Extend Hermes Without Modifying Core Code?

Use cases:
- Add a tool that connects to a private database
- Write to an audit log after every tool call
- Replace the default memory storage backend
- Register a new `/custom-command`

If all of these require modifying Hermes core code, users must fork the repository and lose the ability to pull upstream updates.

---

## Three Plugin Discovery Sources

```python
def discover_plugins(project_dir: str = ".") -> list["Plugin"]:
    """
    Scan three locations for plugins in priority order:
    """
    plugins = []

    # [1] Project-level plugins (highest priority)
    project_plugins = os.path.join(project_dir, ".hermes", "plugins")
    if os.path.isdir(project_plugins):
        plugins.extend(_load_dir_plugins(project_plugins))

    # [2] User-level plugins
    user_plugins = os.path.expanduser("~/.hermes/plugins")
    if os.path.isdir(user_plugins):
        plugins.extend(_load_dir_plugins(user_plugins))

    # [3] pip-installed plugins (entry_points)
    import importlib.metadata
    for ep in importlib.metadata.entry_points(group="hermes.plugins"):
        plugin_cls = ep.load()
        plugins.append(plugin_cls())

    return plugins
```

---

## PluginContext API: The Plugin Registration Interface

```python
class PluginContext:
    """
    The sole interface for plugins to interact with Hermes.
    Plugins do not access registry, hook_manager, etc. directly.
    """
    def __init__(self, registry: ToolRegistry, hook_manager: HookManager,
                 command_registry: dict, memory_providers: list):
        self._registry = registry
        self._hooks = hook_manager
        self._commands = command_registry
        self._memory_providers = memory_providers

    def register_tool(self, name: str, schema: dict, handler: Callable) -> None:
        """Register a new tool into ToolRegistry"""
        self._registry.register(name, schema, handler)

    def register_hook(self, event: HookEvent, handler: HookHandler) -> None:
        """Register a hook handler"""
        self._hooks.register(event, handler)

    def register_command(self, cmd: CommandDef) -> None:
        """Register a new slash command"""
        self._commands[cmd.name] = cmd
        for alias in cmd.aliases:
            self._commands[alias] = cmd

    def register_memory_provider(self, provider: "MemoryProvider") -> None:
        """Register a custom memory storage backend"""
        self._memory_providers.append(provider)
```

---

## Minimal Plugin Example

```python
# .hermes/plugins/audit_logger.py

from hermes.plugin import Plugin, PluginContext
from hermes.hooks import HookEvent
import json, datetime

class AuditLoggerPlugin(Plugin):
    name = "audit-logger"
    version = "1.0.0"
    description = "Log all tool calls to an audit log"

    def setup(self, ctx: PluginContext) -> None:
        ctx.register_hook(HookEvent.POST_TOOL_CALL, self.log_tool_call)

    def log_tool_call(self, data: dict) -> None:
        entry = {
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "tool": data["tool_name"],
            "elapsed_ms": data.get("elapsed_ms"),
        }
        with open("audit.log", "a") as f:
            f.write(json.dumps(entry) + "\n")
```

---

## Memory Provider Plugin (Specialized Type)

```python
from abc import ABC, abstractmethod

class MemoryProvider(ABC):
    """Interface for custom memory storage backends"""

    @abstractmethod
    def read(self, key: str) -> str | None: ...

    @abstractmethod
    def write(self, key: str, value: str) -> None: ...

    @abstractmethod
    def list_keys(self) -> list[str]: ...


# Plugin implementation example: using Redis instead of MEMORY.md file storage
class RedisMemoryProvider(MemoryProvider):
    def __init__(self, redis_url: str):
        import redis
        self.r = redis.from_url(redis_url)

    def read(self, key: str) -> str | None:
        val = self.r.get(f"hermes:memory:{key}")
        return val.decode() if val else None

    def write(self, key: str, value: str) -> None:
        self.r.set(f"hermes:memory:{key}", value)

    def list_keys(self) -> list[str]:
        return [k.decode().split(":")[-1]
                for k in self.r.scan_iter("hermes:memory:*")]
```

---

## Plugin vs Skill: Boundary Comparison

| | Plugin | Skill |
|---|---|---|
| Registration | Python code, implements `Plugin` base class | Markdown file (YAML frontmatter) |
| Capabilities | Register tools, hooks, commands, memory providers | Inject operating guides (text) |
| Activation | Auto-loaded at startup | Activated on demand during sessions (trigger or manual) |
| Scope | Modifies agent capabilities (features) | Influences agent behavior (style/process) |
| Author | Developers (requires Python) | Anyone (only requires Markdown) |

---

## Code Walkthrough: snippets/h18_plugin_system.py

The Code tab for this chapter shows curated snippets from `hermes_cli/plugins.py` and `plugins/memory/`, focusing on:

1. **`discover_plugins()`** — Three-path scanning + entry_points discovery
2. **`PluginContext` encapsulation** — Why the registry isn't exposed directly
3. **`MemoryProvider` ABC** — Abstract interface making memory backends replaceable

---

## Common Misconceptions

**Misconception 1**: Plugins can replace skills  
→ Plugins are code-level extensions (adding tools, hooks); skills are content-level extensions (providing operating guides). The former requires Python; the latter only requires Markdown.

**Misconception 2**: Plugins should directly access the registry object  
→ Plugins operate only through the `PluginContext` interface; Hermes retains flexibility in its internal implementation. If plugins directly accessed `registry`, internal refactoring would break all plugins.

**Misconception 3**: entry_points-based plugins require recompiling Hermes  
→ After `pip install my-hermes-plugin`, the plugin is automatically discovered (via `importlib.metadata`) without modifying any Hermes code.
