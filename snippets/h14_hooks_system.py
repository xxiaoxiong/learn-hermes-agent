# ============================================================
# H14: Hooks System — Hermes Real Source Snippets
# Source: gateway/hooks.py, hermes_cli/plugins.py
#
# 核心洞察：hook 和 plugin 是两个不同的扩展点
#   - Hook: 轻量事件监听，handler.py + HOOK.yaml，filesystem-based
#     在特定生命周期节点（agent:start, session:end 等）触发
#   - Plugin: 完整功能扩展，__init__.py + plugin.yaml，pip/directory-based
#     可注册工具、hook、CLI 命令，拥有 PluginContext facade
# ============================================================


# ── gateway/hooks.py: 1-20 — event contracts ────────────────────────────────
"""
Event Hook System

Events fired at key lifecycle points:
  - gateway:startup     -- Gateway process starts
  - session:start       -- New session created
  - session:end         -- Session ends (/new or /reset)
  - agent:start         -- Agent begins processing a message
  - agent:step          -- Each turn in the tool-calling loop
  - agent:end           -- Agent finishes processing
  - command:*           -- Any slash command executed (wildcard match)

Errors in hooks are caught and logged but NEVER block the main pipeline.
"""


# ── gateway/hooks.py: 34-171 — HookRegistry ──────────────────────────────────
class HookRegistry:
    """
    Discovers, loads, and fires event hooks from ~/.hermes/hooks/.

    Each hook directory must contain:
      - HOOK.yaml with: name, description, events list
      - handler.py with: async def handle(event_type, context)
    """

    def __init__(self):
        self._handlers = {}      # event_type -> [handler_fn, ...]
        self._loaded_hooks = []  # metadata for listing

    def discover_and_load(self) -> None:
        """Scan hooks directory and load all valid hooks.

        Also registers built-in hooks (boot-md on gateway:startup).
        """
        self._register_builtin_hooks()

        if not HOOKS_DIR.exists():
            return

        for hook_dir in sorted(HOOKS_DIR.iterdir()):
            if not hook_dir.is_dir():
                continue
            manifest_path = hook_dir / "HOOK.yaml"
            handler_path = hook_dir / "handler.py"
            if not manifest_path.exists() or not handler_path.exists():
                continue

            try:
                manifest = yaml.safe_load(manifest_path.read_text(encoding="utf-8"))
                hook_name = manifest.get("name", hook_dir.name)
                events = manifest.get("events", [])

                # Dynamically load handler.py
                spec = importlib.util.spec_from_file_location(f"hooks.{hook_name}", handler_path)
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)

                handler_fn = getattr(module, "handle", None)
                if not callable(handler_fn):
                    continue

                for event_type in events:
                    self._handlers.setdefault(event_type, []).append(handler_fn)

                self._loaded_hooks.append({
                    "name": hook_name,
                    "description": manifest.get("description", ""),
                    "events": events,
                    "path": str(hook_dir),
                })
            except Exception as e:
                print(f"[hooks] Failed to load {hook_dir.name}: {e}", flush=True)

    async def emit(self, event_type: str, context: dict) -> None:
        """Fire all handlers for an event type.

        KEY: errors in hooks NEVER propagate — the pipeline always continues.
        """
        handlers = list(self._handlers.get(event_type, []))
        for handler in handlers:
            try:
                if asyncio.iscoroutinefunction(handler):
                    await handler(event_type, context)
                else:
                    handler(event_type, context)
            except Exception as e:
                logger.warning("Hook '%s' failed for event '%s': %s", handler.__module__, event_type, e)


# ── hermes_cli/plugins.py: 55-66 — VALID_HOOKS (plugin hook points) ─────────
# Plugins register hooks at these same event points
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


# ── hermes_cli/plugins.py: 124-160 — PluginContext.register_tool() ───────────
class PluginContext:
    """Facade given to plugins. Bridges to global registry."""

    def register_tool(self, name: str, toolset: str, schema: dict, handler, **kwargs) -> None:
        """Register a tool in the global registry as plugin-provided.

        Plugin tools appear alongside built-in tools from the agent's perspective.
        """
        from tools.registry import registry
        registry.register(name=name, toolset=toolset, schema=schema, handler=handler, **kwargs)
        self._manager._plugin_tool_names.add(name)

    def register_hook(self, event: str, handler) -> None:
        """Register a callback for a lifecycle hook."""
        if event not in VALID_HOOKS:
            raise ValueError(f"Unknown hook: {event!r}")
        self._manager._hooks.setdefault(event, []).append(handler)

    def inject_message(self, content: str, role: str = "user") -> bool:
        """Inject a message into the active CLI conversation.

        If agent is idle → queued as next input.
        If agent is running → interrupts mid-turn.
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


# ── Example: hook that fires on agent:end ─────────────────────────────────────
#
# ~/.hermes/hooks/my-notifier/HOOK.yaml:
#   name: my-notifier
#   description: Send a desktop notification when agent finishes
#   events:
#     - agent:end
#
# ~/.hermes/hooks/my-notifier/handler.py:
#   async def handle(event_type, context):
#       response = context.get("response", "")
#       if len(response) > 50:
#           send_desktop_notification("Hermes", response[:100])
