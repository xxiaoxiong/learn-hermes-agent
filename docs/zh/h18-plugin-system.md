# h18 — Plugin System：不 fork 代码扩展 Hermes

> **核心洞察**：plugin 不是 skill——plugin 注册工具和钩子，skill 注入操作指南；两者边界清晰，不可互换。

---

## 问题：如何让用户扩展 Hermes 而不修改核心代码？

需求场景：
- 添加一个连接私有数据库的工具
- 在每次工具调用后写入审计日志
- 替换默认的 memory 存储后端
- 注册一个新的 `/custom-command`

如果这些都需要修改 Hermes 核心代码，用户就必须 fork 仓库，失去了从上游更新的能力。

---

## 三种插件发现源

```python
def discover_plugins(project_dir: str = ".") -> list["Plugin"]:
    """
    按优先级顺序扫描三个位置的插件：
    """
    plugins = []

    # [1] 项目级插件（最高优先级）
    project_plugins = os.path.join(project_dir, ".hermes", "plugins")
    if os.path.isdir(project_plugins):
        plugins.extend(_load_dir_plugins(project_plugins))

    # [2] 用户级插件
    user_plugins = os.path.expanduser("~/.hermes/plugins")
    if os.path.isdir(user_plugins):
        plugins.extend(_load_dir_plugins(user_plugins))

    # [3] pip 安装的插件（entry_points）
    import importlib.metadata
    for ep in importlib.metadata.entry_points(group="hermes.plugins"):
        plugin_cls = ep.load()
        plugins.append(plugin_cls())

    return plugins
```

---

## PluginContext API：插件注册接口

```python
class PluginContext:
    """
    插件与 Hermes 交互的唯一接口。
    插件不直接访问 registry、hook_manager 等内部对象。
    """
    def __init__(self, registry: ToolRegistry, hook_manager: HookManager,
                 command_registry: dict, memory_providers: list):
        self._registry = registry
        self._hooks = hook_manager
        self._commands = command_registry
        self._memory_providers = memory_providers

    def register_tool(self, name: str, schema: dict, handler: Callable) -> None:
        """注册一个新工具到 ToolRegistry"""
        self._registry.register(name, schema, handler)

    def register_hook(self, event: HookEvent, handler: HookHandler) -> None:
        """注册一个 hook handler"""
        self._hooks.register(event, handler)

    def register_command(self, cmd: CommandDef) -> None:
        """注册一个新 slash command"""
        self._commands[cmd.name] = cmd
        for alias in cmd.aliases:
            self._commands[alias] = cmd

    def register_memory_provider(self, provider: "MemoryProvider") -> None:
        """注册自定义 memory 存储后端"""
        self._memory_providers.append(provider)
```

---

## 最小插件示例

```python
# .hermes/plugins/audit_logger.py

from hermes.plugin import Plugin, PluginContext
from hermes.hooks import HookEvent
import json, datetime

class AuditLoggerPlugin(Plugin):
    name = "audit-logger"
    version = "1.0.0"
    description = "记录所有工具调用到审计日志"

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

## Memory Provider 插件（专用类型）

```python
from abc import ABC, abstractmethod

class MemoryProvider(ABC):
    """自定义 memory 存储后端的接口"""

    @abstractmethod
    def read(self, key: str) -> str | None: ...

    @abstractmethod
    def write(self, key: str, value: str) -> None: ...

    @abstractmethod
    def list_keys(self) -> list[str]: ...


# 插件实现示例：使用 Redis 替代 MEMORY.md 文件存储
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

## Plugin vs Skill：边界对比

| | Plugin | Skill |
|---|---|---|
| 注册方式 | Python 代码，实现 `Plugin` 基类 | Markdown 文件（YAML frontmatter） |
| 能做什么 | 注册工具、hook、命令、memory provider | 注入操作指南（text） |
| 激活时机 | 启动时自动加载 | 会话中按需激活（trigger 或手动） |
| 影响范围 | 修改 agent 能力（功能） | 影响 agent 行为（风格/流程） |
| 编写者 | 开发者（需要写 Python） | 任何人（只需写 Markdown） |

---

## 代码解读：snippets/h18_plugin_system.py

本章 Code 标签展示 `hermes_cli/plugins.py` 和 `plugins/memory/` 的精选片段，关注：

1. **`discover_plugins()`** — 三路径扫描 + entry_points 发现
2. **`PluginContext` 的封装** — 为什么不直接暴露 registry
3. **`MemoryProvider` ABC** — 抽象接口让 memory 后端可替换

---

## 常见误区

**误区 1**：plugin 可以替代 skill  
→ plugin 是代码级扩展（添加工具、钩子），skill 是内容级扩展（提供操作指南）。前者需要 Python，后者只需 Markdown。

**误区 2**：插件应该直接访问 registry 对象  
→ 插件只通过 `PluginContext` 接口操作，Hermes 保留内部实现的灵活性。如果插件直接访问 `registry`，内部重构就会破坏所有插件。

**误区 3**：`entry_points` 方式的插件需要重新编译 Hermes  
→ `pip install my-hermes-plugin` 后，插件自动被发现（通过 `importlib.metadata`），无需修改 Hermes 任何代码。
