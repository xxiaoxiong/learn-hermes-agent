# ============================================================
# H11: CLI Architecture — Hermes Real Source Snippets
# Source: hermes_cli/commands.py, cli.py
#
# 核心洞察：slash command 不是函数调用
# 它是带路由规则的命令描述符。
# COMMAND_REGISTRY 是单一数据源，驱动 CLI / Gateway / Telegram / Slack
# 所有端的 command 列表、help 文本、自动补全和路由逻辑。
# ============================================================


# ── hermes_cli/commands.py: 1-9 — module docstring ─────────────────────────
"""
Slash command definitions and autocomplete for the Hermes CLI.

Central registry for all slash commands. Every consumer -- CLI help, gateway
dispatch, Telegram BotCommands, Slack subcommand mapping, autocomplete --
derives its data from COMMAND_REGISTRY.

To add a command: add a CommandDef entry to COMMAND_REGISTRY.
To add an alias: set aliases=("short",) on the existing CommandDef.
"""


# ── hermes_cli/commands.py: 37-50 — CommandDef dataclass ───────────────────
from dataclasses import dataclass

@dataclass(frozen=True)
class CommandDef:
    """Definition of a single slash command."""

    name: str                           # canonical name without slash: "background"
    description: str                    # human-readable description
    category: str                       # "Session", "Configuration", etc.
    aliases: tuple = ()                 # alternative names: ("bg",)
    args_hint: str = ""                 # argument placeholder: "<prompt>", "[name]"
    subcommands: tuple = ()             # tab-completable subcommands
    cli_only: bool = False              # only available in CLI
    gateway_only: bool = False          # only available in gateway/messaging
    # config dotpath; when truthy, overrides cli_only for gateway
    gateway_config_gate: str = None


# ── hermes_cli/commands.py: 56-120 — COMMAND_REGISTRY (excerpt) ────────────
# KEY: single list → all consumers derive from this
COMMAND_REGISTRY = [
    # Session management
    CommandDef("new", "Start a new session (fresh session ID + history)", "Session",
               aliases=("reset",)),
    CommandDef("clear", "Clear screen and start a new session", "Session", cli_only=True),
    CommandDef("history", "Show conversation history", "Session", cli_only=True),
    CommandDef("retry", "Retry the last message (resend to agent)", "Session"),
    CommandDef("undo", "Remove the last user/assistant exchange", "Session"),
    CommandDef("compress", "Manually compress conversation context", "Session"),
    CommandDef("branch", "Branch the current session (explore a different path)", "Session",
               aliases=("fork",), args_hint="[name]"),
    CommandDef("approve", "Approve a pending dangerous command", "Session",
               gateway_only=True, args_hint="[session|always]"),
    CommandDef("background", "Run a prompt in the background", "Session",
               aliases=("bg",), args_hint="<prompt>"),

    # Memory & Skills
    CommandDef("remember", "Add a memory entry", "Memory", args_hint="<text>"),
    CommandDef("memory", "View or manage memory entries", "Memory",
               subcommands=("list", "clear", "search")),
    CommandDef("skill", "List or activate skills", "Skills",
               subcommands=("list",), args_hint="[name]"),

    # Configuration
    CommandDef("config", "View or set configuration", "Configuration",
               subcommands=("show", "set", "reset"), cli_only=True),
    CommandDef("model", "Switch to a different model", "Configuration",
               args_hint="<name>"),
    CommandDef("provider", "Switch or list providers", "Configuration",
               subcommands=("list",), args_hint="[name]"),

    # Utilities
    CommandDef("help", "Show available commands", "Utilities"),
    CommandDef("resume", "Resume the most recent session", "Utilities"),
    CommandDef("sessions", "List recent sessions", "Utilities"),
    # ... more commands
]


# ── hermes_cli/commands.py — Consumer 1: resolve_command() ──────────────────
# All consumers use the same registry to resolve commands
def resolve_command(text: str):
    """Find a CommandDef by name or alias.

    Returns (CommandDef, remaining_args_str) or (None, text).
    """
    if not text.startswith("/"):
        return None, text
    parts = text[1:].split(None, 1)
    cmd_name = parts[0].lower() if parts else ""
    rest = parts[1] if len(parts) > 1 else ""

    for cmd in COMMAND_REGISTRY:
        if cmd_name == cmd.name or cmd_name in cmd.aliases:
            return cmd, rest
    return None, text


# ── hermes_cli/commands.py — Consumer 2: gateway_help_lines() ───────────────
# Gateway uses the same registry to build /help text
def gateway_help_lines() -> list:
    """Return formatted help lines for gateway /help command."""
    lines = []
    for cmd in COMMAND_REGISTRY:
        if cmd.cli_only:
            continue  # skip CLI-only commands in gateway context
        hint = f" {cmd.args_hint}" if cmd.args_hint else ""
        lines.append(f"/{cmd.name}{hint} — {cmd.description}")
    return lines


# ── Consumer 3: Telegram BotCommands ────────────────────────────────────────
# gateway/platforms/telegram.py derives bot command list from the same registry:
#
#   bot_commands = [
#       BotCommand(f"/{cmd.name}", cmd.description[:256])
#       for cmd in COMMAND_REGISTRY
#       if not cmd.cli_only
#   ]
#   await bot.set_my_commands(bot_commands)
#
# Consumer 4: CLI tab completion (SlashCommandCompleter)
# Consumer 5: Slack slash command routing
# All derive from COMMAND_REGISTRY — one change propagates everywhere.
