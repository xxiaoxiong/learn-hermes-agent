# h12 — Gateway System: GatewayRunner Unified Access for 15 Platforms

> **Core Insight**: The platform adapter layer ≠ agent logic — the adapter only handles format conversion; AIAgent is completely unaware of the platform.

---

## The Problem: How to Serve 15 Different Platforms with the Same AIAgent?

Each platform has a different message format:

```
Telegram: Update → message → text / photo / document
Discord:  Interaction → data → content
Slack:    SlashCommand → text → command + text
Email:    EmailMessage → subject + body
```

If platform logic is written into AIAgent, it becomes a massive if-else collection.

---

## The Solution: Platform Adapter + Unified MessageEvent

```python
from dataclasses import dataclass

@dataclass
class MessageEvent:
    """Unified format for all platform messages"""
    platform: str           # "telegram" / "discord" / "slack"
    user_id: str            # Sender ID (unique within platform)
    chat_id: str            # Conversation ID (group, channel, or DM)
    text: str               # Message text content
    attachments: list[dict] # Attachments (images, files…)
    raw: dict               # Original platform message (for debugging)
    metadata: dict          # Platform-specific metadata
```

Each platform implements an Adapter responsible for converting native platform messages into `MessageEvent`:

```python
class TelegramAdapter:
    def parse(self, update: dict) -> MessageEvent:
        msg = update["message"]
        return MessageEvent(
            platform="telegram",
            user_id=str(msg["from"]["id"]),
            chat_id=str(msg["chat"]["id"]),
            text=msg.get("text", ""),
            attachments=[...],
            raw=update,
            metadata={"update_id": update["update_id"]},
        )

    async def deliver(self, chat_id: str, text: str) -> None:
        """Send a reply to Telegram"""
        await self.bot.send_message(chat_id=chat_id, text=text)
```

---

## GatewayRunner: Message Dispatch Main Loop

```python
class GatewayRunner:
    def __init__(self, adapters: list[PlatformAdapter], agent_factory):
        self.adapters = adapters
        self.agent_factory = agent_factory  # Factory function to create AIAgent instances
        self._sessions: dict[str, AIAgent] = {}  # session_key → AIAgent

    async def _handle_message(self, event: MessageEvent) -> None:
        """
        Core dispatch logic:
        1. Generate session key
        2. Get or create the corresponding AIAgent
        3. Call the agent to process the message
        4. Send the reply back to the platform
        """
        session_key = self._make_session_key(event)
        agent = self._get_or_create_agent(session_key, event.platform)

        # AIAgent.run_conversation() is completely unaware of the platform type
        reply = agent.run_conversation(event.text)

        # Send back via the corresponding adapter
        adapter = self._get_adapter(event.platform)
        await adapter.deliver(event.chat_id, reply)

    def _make_session_key(self, event: MessageEvent) -> str:
        """
        Per-platform + per-user session key:
        Ensures conversations across platforms and users don't interfere
        """
        return f"{event.platform}:{event.user_id}:{event.chat_id}"
```

---

## Session Routing: Per-Platform + Per-User

```
Telegram user 123 → session_key = "telegram:123:chat456"
Discord user 456  → session_key = "discord:456:channel789"
CLI user          → session_key = "cli:local:local"
```

The same user on different platforms gets different sessions (isolation). The same user on the same platform with multiple messages shares the same session (continuous conversation).

---

## DM Pairing: Security Authorization Mechanism

To prevent unauthorized users from accessing the agent, Hermes supports DM pairing:

```python
class DMPairing:
    def __init__(self):
        self._allowlist: set[str] = set()     # Authorized user_ids
        self._pending_codes: dict[str, str] = {}  # pairing_code → user_id

    def generate_pairing_code(self, user_id: str) -> str:
        """Generate a 6-character pairing code"""
        code = secrets.token_hex(3).upper()  # e.g. "A3F7B2"
        self._pending_codes[code] = user_id
        return code

    def claim_code(self, code: str, user_id: str) -> bool:
        """User submits a pairing code; after verification, added to allowlist"""
        if code in self._pending_codes and self._pending_codes[code] == user_id:
            self._allowlist.add(user_id)
            del self._pending_codes[code]
            return True
        return False

    def is_authorized(self, user_id: str) -> bool:
        return user_id in self._allowlist
```

---

## Code Walkthrough: snippets/h12_gateway.py

The Code tab for this chapter shows curated snippets from `gateway/run.py` and `gateway/platforms/`, focusing on:

1. **`MessageEvent` unified format** — The standardized output structure of adapters
2. **`GatewayRunner._handle_message()`** — Core dispatch logic
3. **Session key generation** — Three-dimensional isolation: platform + user + chat

---

## Common Misconceptions

**Misconception 1**: Different platforms need different AIAgent classes  
→ The same `AIAgent` class serves all platforms. Platform differences are entirely encapsulated in the adapter; AIAgent only sees `MessageEvent.text`.

**Misconception 2**: session_key only needs user_id  
→ It needs three dimensions (platform + user_id + chat_id). The same Telegram user in different groups should have independent conversation contexts.

**Misconception 3**: GatewayRunner is an HTTP server  
→ It is not. It is a long-running process that receives messages through each platform's SDK/webhook. HTTP is an implementation detail of each platform's SDK, transparent to GatewayRunner.
