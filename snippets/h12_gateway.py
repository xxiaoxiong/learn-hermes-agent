# ============================================================
# H12: Multi-Platform Gateway — Hermes Real Source Snippets
# Source: gateway/run.py, gateway/platforms/base.py
#
# 核心洞察：所有平台共用同一个 _handle_message()
# 平台适配器只负责消息格式转换。一旦转为 MessageEvent，
# 后续的 session 路由、agent 调度、命令解析完全相同。
# ============================================================


# ── gateway/platforms/base.py — MessageEvent (transport contract) ───────────
from enum import Enum
from dataclasses import dataclass, field
from typing import Optional

class MessageType(Enum):
    TEXT = "text"
    VOICE = "voice"
    IMAGE = "image"
    FILE = "file"
    REACTION = "reaction"
    COMMAND = "command"


@dataclass
class MessageSource:
    """Who sent the message and from which platform."""
    platform: str           # "telegram", "discord", "slack", "signal", ...
    user_id: str
    chat_id: str
    username: str = ""
    is_group: bool = False
    thread_id: Optional[str] = None


@dataclass
class MessageEvent:
    """Normalized message from any platform adapter.

    KEY: once a message reaches _handle_message(), platform is irrelevant.
    All downstream code works with MessageEvent regardless of origin platform.
    """
    text: str
    message_type: MessageType
    source: MessageSource
    message_id: Optional[str] = None
    reply_to_id: Optional[str] = None
    media_url: Optional[str] = None

    def get_command_args(self) -> str:
        """Return text after the first command token."""
        parts = self.text.split(None, 1)
        return parts[1] if len(parts) > 1 else ""

    def is_command(self) -> bool:
        return self.text.startswith("/")


# ── gateway/platforms/base.py — BasePlatformAdapter ─────────────────────────
class BasePlatformAdapter:
    """Base class for all platform adapters.

    Each platform (Telegram, Discord, Slack, etc.) subclasses this and:
    1. Receives native platform events
    2. Converts them to MessageEvent objects
    3. Calls self._message_handler(event)

    Sending works in reverse: response text → platform-native format.
    """

    def set_message_handler(self, handler) -> None:
        """Register the callback for normalized incoming messages."""
        self._message_handler = handler

    async def send_message(self, chat_id: str, text: str, **kwargs) -> None:
        """Send a response back to a chat. Subclasses implement platform-specific delivery."""
        raise NotImplementedError


# ── gateway/run.py: 1826-1840 — unified message entry point ─────────────────
class GatewayRunner:
    """
    Main gateway controller.

    Manages all platform adapters. All adapters call self._handle_message()
    which provides a single entry point for session routing and agent dispatch.
    """

    async def _handle_message(self, event: MessageEvent) -> Optional[str]:
        """
        Handle an incoming message from ANY platform.

        This single method handles messages from Telegram, Discord, Slack,
        Signal, iMessage, Email, Webhook, and all other adapters.

        Steps:
        1. Extract session source (platform + user_id + chat_id)
        2. Check if a running agent exists → queue or interrupt
        3. Parse slash command or forward to agent
        4. Dispatch to _handle_message_with_agent()
        """
        source = event.source

        # Step 1: Session key = (platform, chat_id) — shared group sessions
        _quick_key = build_session_key(source)

        # Step 2: Dedup / handle concurrent messages for same session
        existing = self._running_agents.get(_quick_key)
        if existing and event.is_command() and event.text.startswith("/stop"):
            return await self._handle_stop_command(event)

        # Step 3: Slash commands → parse and handle or forward to agent
        if event.is_command():
            result = await self._handle_command(event, source, _quick_key)
            if result is not None:
                return result

        # Step 4: Dispatch to agent
        self._running_agents_ts[_quick_key] = time.time()
        try:
            return await self._handle_message_with_agent(event, source, _quick_key)
        finally:
            self._running_agents_ts.pop(_quick_key, None)
