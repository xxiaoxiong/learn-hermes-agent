# ============================================================
# H18: Plugin System — Hermes Real Source Snippets
# Source: hermes_cli/plugins.py
#
# 核心洞察：插件是完整的功能模块
# Plugin vs Hook:
#   Hook  = 单文件事件监听，适合轻量观察/通知
#   Plugin = 完整模块，可注册工具、hooks、CLI 命令，适合完整功能扩展
#
# 插件发现顺序（优先级由高到低）：
#   1. User plugins   — ~/.hermes/plugins/<name>/
#   2. Project plugins — ./.hermes/plugins/<name>/  (opt-in env var)
#   3. Pip plugins    — hermes_agent.plugins entry-point group
# ============================================================


# ── hermes_cli/plugins.py: 55-66 — lifecycle hook points ────────────────────
VALID_HOOKS = {
    "pre_tool_call",
    "post_tool_call",
    "pre_llm_call",
    "post_llm_call",
    "pre_api_request",
    "post_api_request",
    "on_session_start",
    "on_session_end",
    "on_session_finalize",
    "on_session_reset",
}


# ── hermes_cli/plugins.py: 94-118 — manifest dataclasses ─────────────────────
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any, Callable

@dataclass
class PluginManifest:
    """Parsed representation of a plugin.yaml manifest."""
    name: str
    version: str = ""
    description: str = ""
    author: str = ""
    requires_env: List = field(default_factory=list)
    provides_tools: List[str] = field(default_factory=list)
    provides_hooks: List[str] = field(default_factory=list)
    source: str = ""       # "user", "project", or "entrypoint"
    path: Optional[str] = None


@dataclass
class LoadedPlugin:
    """Runtime state for a single loaded plugin."""
    manifest: PluginManifest
    module = None
    tools_registered: List[str] = field(default_factory=list)
    hooks_registered: List[str] = field(default_factory=list)
    enabled: bool = False
    error: Optional[str] = None


# ── hermes_cli/plugins.py: 124-200 — PluginContext facade ────────────────────
class PluginContext:
    """Facade given to plugins' register(ctx) function.

    Provides safe access to core systems without exposing internals.
    """

    def register_tool(self, name: str, toolset: str, schema: dict,
                      handler: Callable, **kwargs) -> None:
        """Register a tool in the global registry as plugin-provided.

        Plugin tools appear alongside built-in tools. The agent cannot
        distinguish plugin tools from native tools.
        """
        from tools.registry import registry
        registry.register(name=name, toolset=toolset, schema=schema,
                          handler=handler, **kwargs)
        self._manager._plugin_tool_names.add(name)

    def register_hook(self, event: str, handler: Callable) -> None:
        """Register a callback for a lifecycle hook event."""
        if event not in VALID_HOOKS:
            raise ValueError(f"Unknown hook: {event!r}. Valid hooks: {sorted(VALID_HOOKS)}")
        self._manager._hooks.setdefault(event, []).append(handler)

    def inject_message(self, content: str, role: str = "user") -> bool:
        """Inject a message into the active CLI conversation.

        Idle agent   → queue as next user input
        Running agent → interrupt mid-turn with the message
        """
        cli = self._manager._cli_ref
        if cli is None:
            return False
        msg = content if role == "user" else f"[{role}] {content}"
        if getattr(cli, "_agent_running", False):
            cli._interrupt_queue.put(msg)
        else:
            cli._pending_input.put(msg)
        return True

    def register_cli_command(self, name: str, help: str, setup_fn: Callable,
                             handler_fn: Callable = None, description: str = "") -> None:
        """Register a new CLI subcommand (e.g. 'hermes my-plugin <args>')."""
        self._manager._cli_commands[name] = {
            "help": help, "description": description,
            "setup_fn": setup_fn, "handler_fn": handler_fn,
        }


# ── Plugin discovery and loading ──────────────────────────────────────────────
# Each directory plugin must contain:
#   ~/.hermes/plugins/my-plugin/plugin.yaml
#   ~/.hermes/plugins/my-plugin/__init__.py   (with register(ctx) function)

# Example plugin.yaml:
# ---
# name: my-plugin
# version: "1.0"
# description: An example plugin
# provides_tools: [my_search]
# provides_hooks: [post_llm_call]

# Example __init__.py:
# def register(ctx):
#     ctx.register_tool(
#         name="my_search",
#         toolset="web",
#         schema={
#             "name": "my_search",
#             "description": "Search with my plugin",
#             "parameters": {
#                 "type": "object",
#                 "properties": {"query": {"type": "string"}},
#                 "required": ["query"],
#             },
#         },
#         handler=lambda args, **kw: my_search_impl(args["query"]),
#     )
#     ctx.register_hook("post_llm_call", my_post_llm_hook)
