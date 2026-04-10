# h11 — CLI Architecture：COMMAND_REGISTRY 驱动多端 slash command

> **核心洞察**：slash command 不是函数调用——它是带路由规则的命令描述符，同一份 registry 驱动所有端（CLI / Gateway / Telegram）。

---

## 问题：多端 slash command 如何避免重复实现？

Hermes 支持在 CLI、Telegram、Discord 等多个平台使用 `/search`、`/skills`、`/memory` 等 slash command。

如果每个平台各自实现：

```python
# ❌ CLI 里
if user_input.startswith("/search"):
    ...

# ❌ Telegram handler 里
if message.text.startswith("/search"):
    ...

# ❌ Discord handler 里
if message.content.startswith("/search"):
    ...
```

三处重复代码，改一次要改三次。

---

## 解决方案：COMMAND_REGISTRY

所有 slash command 在一个中心注册表里定义，各端从同一 registry 查询和执行：

```python
from dataclasses import dataclass, field
from typing import Callable, Any

@dataclass
class CommandDef:
    name: str               # 主命令名，如 "search"
    aliases: list[str]      # 别名，如 ["find", "s"]
    handler: Callable       # 执行函数
    help_text: str          # 帮助说明
    args_schema: dict       # 参数格式（供校验和文档生成）
    platforms: list[str] = field(default_factory=lambda: ["cli", "gateway", "telegram"])
    # platforms 限定哪些端支持这条命令

COMMAND_REGISTRY: dict[str, CommandDef] = {}

def register_command(cmd: CommandDef) -> None:
    """注册命令，同时注册所有别名"""
    COMMAND_REGISTRY[cmd.name] = cmd
    for alias in cmd.aliases:
        COMMAND_REGISTRY[alias] = cmd  # 别名指向同一个 CommandDef
```

---

## 注册示例

```python
# hermes_cli/commands.py

register_command(CommandDef(
    name="search",
    aliases=["find", "s"],
    handler=handle_search,
    help_text="/search <query>  — 搜索历史会话",
    args_schema={"query": {"type": "string", "required": True}},
    platforms=["cli", "gateway", "telegram"],
))

register_command(CommandDef(
    name="skills",
    aliases=["skill"],
    handler=handle_skills,
    help_text="/skills [name]  — 列出或激活 skill",
    args_schema={"name": {"type": "string", "required": False}},
))

register_command(CommandDef(
    name="memory",
    aliases=["mem"],
    handler=handle_memory,
    help_text="/memory  — 查看当前 MEMORY.md 内容",
    args_schema={},
    platforms=["cli"],  # 仅 CLI 支持
))
```

---

## resolve_command：别名解析 + 模糊匹配

```python
def resolve_command(input_str: str) -> CommandDef | None:
    """
    解析 slash command 输入：
    1. 提取命令名（去掉 /，分离参数）
    2. 精确匹配（name 或 alias）
    3. 模糊匹配（前缀匹配，如 /se → search）
    """
    if not input_str.startswith("/"):
        return None

    parts = input_str[1:].strip().split(maxsplit=1)
    cmd_name = parts[0].lower()

    # 精确匹配
    if cmd_name in COMMAND_REGISTRY:
        return COMMAND_REGISTRY[cmd_name]

    # 前缀模糊匹配（唯一匹配才生效，避免歧义）
    matches = [name for name in COMMAND_REGISTRY if name.startswith(cmd_name)]
    unique_cmds = {COMMAND_REGISTRY[m] for m in matches}
    if len(unique_cmds) == 1:
        return next(iter(unique_cmds))

    return None
```

---

## 多端派生：同一 registry，不同调用路径

```
COMMAND_REGISTRY
    ├── CLI：parse_input() → resolve_command() → cmd.handler(args, context="cli")
    ├── Gateway：on_message() → resolve_command() → cmd.handler(args, context="gateway")
    └── Telegram：on_update() → resolve_command() → cmd.handler(args, context="telegram")
```

`context` 参数让 handler 知道当前运行在哪个平台，可以做平台特定的输出格式化：

```python
def handle_search(args: dict, context: str = "cli") -> str:
    results = session_db.search(args["query"])
    if context == "telegram":
        # Telegram 消息支持 Markdown
        return "\n".join(f"*{r.session_id}*: {r.preview}" for r in results)
    else:
        # CLI 纯文本
        return "\n".join(f"{r.session_id}: {r.preview}" for r in results)
```

---

## Skin Engine（数据驱动 TUI 主题）

Hermes 的 CLI 界面（`skin_engine.py`）也是数据驱动的：

```python
# 主题数据结构
SKIN_CONFIG = {
    "default": {
        "prompt_prefix": "❯ ",
        "tool_call_color": "cyan",
        "tool_result_color": "green",
        "error_color": "red",
    },
    "minimal": {
        "prompt_prefix": "> ",
        "tool_call_color": None,
        "tool_result_color": None,
        "error_color": None,
    },
}
```

通过切换 `SKIN_CONFIG` 键名，完全改变 CLI 视觉样式，不改一行显示逻辑。

---

## 代码解读：snippets/h11_cli_architecture.py

本章 Code 标签展示 `hermes_cli/commands.py` 和 `cli.py` 的精选片段，关注：

1. **`CommandDef` 的完整字段** — 每个命令的元数据
2. **`COMMAND_REGISTRY` 的构建** — 注册与别名映射
3. **`resolve_command()`** — 解析与模糊匹配逻辑

---

## 常见误区

**误区 1**：slash command 是模型功能  
→ slash command 是人工操作的 CLI/Gateway 命令，由代码处理，不经过模型。`/search` 直接查 SQLite，不问模型。

**误区 2**：每个平台应该有自己的命令集  
→ 统一注册表，用 `platforms` 字段限定哪些端支持。这样添加新命令时，只需在注册表里指定支持的平台即可。

**误区 3**：别名解析应该在每个平台各自做  
→ `resolve_command()` 是公共函数，所有平台共用。平台只负责提取用户输入的字符串，解析和执行交给公共层。
