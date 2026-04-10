# ============================================================
# H07: Memory System — Hermes Real Source Snippets
# Source: tools/memory_tool.py, run_agent.py
#
# 核心洞察：memory flush 在 turn 结束前执行
# 两层记忆：
#   - MemoryStore (built-in) — MEMORY.md + USER.md 文件持久化
#   - MemoryManager (plugin) — 可插拔外部 provider (Honcho / Mem0 等)
# ============================================================


# ── tools/memory_tool.py: 100-135 ──────────────────────────────────────────
class MemoryStore:
    """
    Bounded curated memory with file persistence. One instance per AIAgent.

    Maintains two parallel states:
      - _system_prompt_snapshot: frozen at load time, used for system prompt injection.
        Never mutated mid-session. Keeps prefix cache stable.
      - memory_entries / user_entries: live state, mutated by tool calls, persisted to disk.
        Tool responses always reflect this live state.
    """

    def __init__(self, memory_char_limit: int = 2200, user_char_limit: int = 1375):
        self.memory_entries = []
        self.user_entries = []
        self.memory_char_limit = memory_char_limit
        self.user_char_limit = user_char_limit
        # Frozen snapshot for system prompt -- set once at load_from_disk()
        self._system_prompt_snapshot = {"memory": "", "user": ""}

    def load_from_disk(self):
        """Load entries from MEMORY.md and USER.md, capture system prompt snapshot."""
        mem_dir = get_memory_dir()
        mem_dir.mkdir(parents=True, exist_ok=True)

        self.memory_entries = self._read_file(mem_dir / "MEMORY.md")
        self.user_entries = self._read_file(mem_dir / "USER.md")

        # Deduplicate entries (preserves order, keeps first occurrence)
        self.memory_entries = list(dict.fromkeys(self.memory_entries))
        self.user_entries = list(dict.fromkeys(self.user_entries))

        # Capture frozen snapshot for system prompt injection
        # KEY: snapshot is frozen at load time, not mutated mid-session
        # This keeps the Anthropic prefix cache stable across turns
        self._system_prompt_snapshot = {
            "memory": self._render_block("memory", self.memory_entries),
            "user": self._render_block("user", self.user_entries),
        }

    def save_to_disk(self, target: str):
        """Persist entries to the appropriate file. Called after every mutation."""
        get_memory_dir().mkdir(parents=True, exist_ok=True)
        self._write_file(self._path_for(target), self._entries_for(target))


# ── run_agent.py: 5985-6144 ──────────────────────────────────────────────────
# KEY: flush_memories() は compression/exit 前に呼ばれる
# 上下文里的知识 ≠ 记忆——没写入 MEMORY.md 就等于没记住
def flush_memories(self, messages: list = None, min_turns: int = None):
    """Give the model one turn to persist memories before context is lost.

    Called before compression, session reset, or CLI exit. Injects a flush
    message, makes one API call, executes any memory tool calls, then
    strips all flush artifacts from the message list.

    Args:
        messages: The current conversation messages.
        min_turns: Minimum user turns required to trigger the flush.
                   None = use config value (flush_min_turns).
                   0 = always flush (used for compression).
    """
    # Guard: only flush if memory tool is available and min_turns met
    if self._memory_flush_min_turns == 0 and min_turns is None:
        return
    if "memory" not in self.valid_tool_names or not self._memory_store:
        return
    effective_min = min_turns if min_turns is not None else self._memory_flush_min_turns
    if self._user_turn_count < effective_min:
        return

    if messages is None:
        messages = getattr(self, '_session_messages', None)
    if not messages or len(messages) < 3:
        return

    # Inject a special flush user message that triggers memory writing
    flush_content = (
        "[System: The session is being compressed. "
        "Save anything worth remembering — prioritize user preferences, "
        "corrections, and recurring patterns over task-specific details.]"
    )
    _sentinel = f"__flush_{id(self)}_{time.monotonic()}"
    flush_msg = {"role": "user", "content": flush_content, "_flush_sentinel": _sentinel}
    messages.append(flush_msg)

    try:
        # ... (make one API call with only memory tool available)
        # Execute any memory tool calls returned
        for tc in tool_calls:
            if tc.function.name == "memory":
                args = json.loads(tc.function.arguments)
                memory_tool(
                    action=args.get("action"),
                    target=args.get("target", "memory"),
                    content=args.get("content"),
                    old_text=args.get("old_text"),
                    store=self._memory_store,
                )
    finally:
        # Strip flush artifacts: remove everything from flush message onward
        # Sentinel marker (not identity check) ensures robustness
        while messages and messages[-1].get("_flush_sentinel") != _sentinel:
            messages.pop()
            if not messages:
                break
        if messages and messages[-1].get("_flush_sentinel") == _sentinel:
            messages.pop()


# ── agent/memory_provider.py: 1-31 (interface contract) ────────────────────
"""
Abstract base class for pluggable memory providers.

Memory providers give the agent persistent recall across sessions. One
external provider is active at a time alongside the always-on built-in
memory (MEMORY.md / USER.md). The MemoryManager enforces this limit.

Lifecycle (called by MemoryManager, wired in run_agent.py):
  initialize()          — connect, create resources, warm up
  system_prompt_block()  — static text for the system prompt
  prefetch(query)        — background recall before each turn
  sync_turn(user, asst)  — async write after each turn
  get_tool_schemas()     — tool schemas to expose to the model
  handle_tool_call()     — dispatch a tool call
  shutdown()             — clean exit

Optional hooks (override to opt in):
  on_turn_start(turn, message, **kwargs) — per-turn tick with runtime context
  on_session_end(messages)               — end-of-session extraction
  on_pre_compress(messages) -> str       — extract before context compression
  on_memory_write(action, target, content) — mirror built-in memory writes
"""


# ── agent/memory_manager.py: 197-256 ───────────────────────────────────────
# MemoryManager fanout: distributes calls to all registered providers
class MemoryManager:
    def sync_all(self, user_content: str, assistant_content: str, *, session_id: str = "") -> None:
        """Sync a completed turn to all providers."""
        for provider in self._providers:
            try:
                provider.sync_turn(user_content, assistant_content, session_id=session_id)
            except Exception as e:
                logger.warning(
                    "Memory provider '%s' sync_turn failed: %s",
                    provider.name, e,
                )

    def handle_tool_call(self, tool_name: str, args: dict, **kwargs) -> str:
        """Route a tool call to the correct provider."""
        provider = self._tool_to_provider.get(tool_name)
        if provider is None:
            return tool_error(f"No memory provider handles tool '{tool_name}'")
        try:
            return provider.handle_tool_call(tool_name, args, **kwargs)
        except Exception as e:
            return tool_error(f"Memory tool '{tool_name}' failed: {e}")
