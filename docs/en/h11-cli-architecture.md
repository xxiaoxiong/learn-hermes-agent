# h11 — CLI Architecture: COMMAND_REGISTRY Driving Multi-Surface Slash Commands

> **Core Insight**: A slash command is not a function call — it is a command descriptor with routing rules, and a single registry drives all surfaces (CLI / Gateway / Telegram).

---

## The Problem: How to Avoid Duplicate Slash Command Implementations Across Surfaces?

Hermes supports `/search`, `/skills`, `/memory`, and other slash commands across CLI, Telegram, Discord, and more.

If each platform implements its own:

```python
# ❌ In CLI
if user_input.startswith("/search"):
    ...

# ❌ In Telegram handler
if message.text.startswith("/search"):
    ...

# ❌ In Discord handler
if message.content.startswith("/search"):
    ...
```

Three duplicated implementations, each change must be made three times.

---

## The Solution: COMMAND_REGISTRY

All slash commands are defined in a central registry; each surface queries and executes from the same registry:

```python
from dataclasses import dataclass, field
from typing import Callable, Any

@dataclass
class CommandDef:
    name: str               # Primary command name, e.g. "search"
    aliases: list[str]      # Aliases, e.g. ["find", "s"]
    handler: Callable       # Execution function
    help_text: str          # Help description
    args_schema: dict       # Parameter format (for validation and docs)
    platforms: list[str] = field(default_factory=lambda: ["cli", "gateway", "telegram"])
    # platforms restricts which surfaces support this command

COMMAND_REGISTRY: dict[str, CommandDef] = {}

def register_command(cmd: CommandDef) -> None:
    """Register a command, including all its aliases"""
    COMMAND_REGISTRY[cmd.name] = cmd
    for alias in cmd.aliases:
        COMMAND_REGISTRY[alias] = cmd  # Aliases point to the same CommandDef
```

---

## Registration Examples

```python
# hermes_cli/commands.py

register_command(CommandDef(
    name="search",
    aliases=["find", "s"],
    handler=handle_search,
    help_text="/search <query>  — Search past sessions",
    args_schema={"query": {"type": "string", "required": True}},
    platforms=["cli", "gateway", "telegram"],
))

register_command(CommandDef(
    name="skills",
    aliases=["skill"],
    handler=handle_skills,
    help_text="/skills [name]  — List or activate a skill",
    args_schema={"name": {"type": "string", "required": False}},
))

register_command(CommandDef(
    name="memory",
    aliases=["mem"],
    handler=handle_memory,
    help_text="/memory  — View current MEMORY.md contents",
    args_schema={},
    platforms=["cli"],  # CLI only
))
```

---

## resolve_command: Alias Resolution + Fuzzy Matching

```python
def resolve_command(input_str: str) -> CommandDef | None:
    """
    Parse slash command input:
    1. Extract the command name (remove /, separate args)
    2. Exact match (name or alias)
    3. Fuzzy match (prefix match, e.g. /se → search)
    """
    if not input_str.startswith("/"):
        return None

    parts = input_str[1:].strip().split(maxsplit=1)
    cmd_name = parts[0].lower()

    # Exact match
    if cmd_name in COMMAND_REGISTRY:
        return COMMAND_REGISTRY[cmd_name]

    # Prefix fuzzy match (only activates on a unique match to avoid ambiguity)
    matches = [name for name in COMMAND_REGISTRY if name.startswith(cmd_name)]
    unique_cmds = {COMMAND_REGISTRY[m] for m in matches}
    if len(unique_cmds) == 1:
        return next(iter(unique_cmds))

    return None
```

---

## Multi-Surface Derivation: Same Registry, Different Call Paths

```
COMMAND_REGISTRY
    ├── CLI:      parse_input() → resolve_command() → cmd.handler(args, context="cli")
    ├── Gateway:  on_message() → resolve_command() → cmd.handler(args, context="gateway")
    └── Telegram: on_update() → resolve_command() → cmd.handler(args, context="telegram")
```

The `context` parameter tells the handler which platform is currently active, enabling platform-specific output formatting:

```python
def handle_search(args: dict, context: str = "cli") -> str:
    results = session_db.search(args["query"])
    if context == "telegram":
        # Telegram messages support Markdown
        return "\n".join(f"*{r.session_id}*: {r.preview}" for r in results)
    else:
        # CLI plain text
        return "\n".join(f"{r.session_id}: {r.preview}" for r in results)
```

---

## Skin Engine (Data-Driven TUI Themes)

Hermes' CLI interface (`skin_engine.py`) is also data-driven:

```python
# Theme data structure
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

Switching `SKIN_CONFIG` key names completely changes the CLI visual style without modifying a single line of display logic.

---

## Code Walkthrough: snippets/h11_cli_architecture.py

The Code tab for this chapter shows curated snippets from `hermes_cli/commands.py` and `cli.py`, focusing on:

1. **`CommandDef`'s complete fields** — Metadata for each command
2. **`COMMAND_REGISTRY` construction** — Registration and alias mapping
3. **`resolve_command()`** — Parsing and fuzzy matching logic

---

## Common Misconceptions

**Misconception 1**: Slash commands are a model feature  
→ Slash commands are manual CLI/Gateway operations, handled by code, not the model. `/search` queries SQLite directly without asking the model.

**Misconception 2**: Each platform should have its own command set  
→ One unified registry, with the `platforms` field restricting which surfaces support each command. Adding a new command only requires specifying supported platforms in the registry.

**Misconception 3**: Alias resolution should be done separately on each platform  
→ `resolve_command()` is a shared function used by all platforms. Platforms are only responsible for extracting the user's input string; parsing and execution are handled by the common layer.
