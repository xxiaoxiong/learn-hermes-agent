# h12 — Gateway System：GatewayRunner 统一接入 15 个平台

> **核心洞察**：平台适配层 ≠ agent 逻辑——adapter 只负责格式转换，AIAgent 对平台完全无感。

---

## 问题：如何让同一个 AIAgent 服务 15 个不同平台？

每个平台的消息格式不同：

```
Telegram: Update → message → text / photo / document
Discord:  Interaction → data → content
Slack:    SlashCommand → text → command + text
Email:    EmailMessage → subject + body
```

如果把平台逻辑写进 AIAgent 里，AIAgent 会变成一个巨大的 if-else 集合。

---

## 解决方案：Platform Adapter + 统一 MessageEvent

```python
from dataclasses import dataclass

@dataclass
class MessageEvent:
    """所有平台消息的统一格式"""
    platform: str           # "telegram" / "discord" / "slack"
    user_id: str            # 发送者 ID（平台内唯一）
    chat_id: str            # 会话 ID（群组、频道或私聊）
    text: str               # 消息文本内容
    attachments: list[dict] # 附件（图片、文件…）
    raw: dict               # 原始平台消息（调试用）
    metadata: dict          # 平台特有元数据
```

每个平台实现一个 Adapter，负责把平台原生消息转换为 `MessageEvent`：

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
        """发送回复到 Telegram"""
        await self.bot.send_message(chat_id=chat_id, text=text)
```

---

## GatewayRunner：消息分发主循环

```python
class GatewayRunner:
    def __init__(self, adapters: list[PlatformAdapter], agent_factory):
        self.adapters = adapters
        self.agent_factory = agent_factory  # 创建 AIAgent 实例的工厂函数
        self._sessions: dict[str, AIAgent] = {}  # session_key → AIAgent

    async def _handle_message(self, event: MessageEvent) -> None:
        """
        核心分发逻辑：
        1. 生成 session key
        2. 获取或创建对应 AIAgent
        3. 调用 agent 处理消息
        4. 把回复发回平台
        """
        session_key = self._make_session_key(event)
        agent = self._get_or_create_agent(session_key, event.platform)

        # AIAgent.run_conversation() 对平台类型完全无感
        reply = agent.run_conversation(event.text)

        # 通过对应 adapter 发回平台
        adapter = self._get_adapter(event.platform)
        await adapter.deliver(event.chat_id, reply)

    def _make_session_key(self, event: MessageEvent) -> str:
        """
        per-platform + per-user 的 session key：
        保证不同平台、不同用户的会话互不干扰
        """
        return f"{event.platform}:{event.user_id}:{event.chat_id}"
```

---

## Session Routing：per-platform + per-user

```
Telegram 用户 123 → session_key = "telegram:123:chat456"
Discord 用户 456  → session_key = "discord:456:channel789"
CLI 用户           → session_key = "cli:local:local"
```

同一个用户在不同平台是不同的 session（隔离）。同一个用户在同一平台的多次消息共享同一个 session（连续对话）。

---

## DM Pairing：安全授权机制

为了防止未授权用户访问 agent，Hermes 支持 DM pairing：

```python
class DMPairing:
    def __init__(self):
        self._allowlist: set[str] = set()     # 已授权的 user_id
        self._pending_codes: dict[str, str] = {}  # pairing_code → user_id

    def generate_pairing_code(self, user_id: str) -> str:
        """生成 6 位数配对码"""
        code = secrets.token_hex(3).upper()  # e.g. "A3F7B2"
        self._pending_codes[code] = user_id
        return code

    def claim_code(self, code: str, user_id: str) -> bool:
        """用户提交配对码，验证后加入 allowlist"""
        if code in self._pending_codes and self._pending_codes[code] == user_id:
            self._allowlist.add(user_id)
            del self._pending_codes[code]
            return True
        return False

    def is_authorized(self, user_id: str) -> bool:
        return user_id in self._allowlist
```

---

## 代码解读：snippets/h12_gateway.py

本章 Code 标签展示 `gateway/run.py` 和 `gateway/platforms/` 的精选片段，关注：

1. **`MessageEvent` 统一格式** — 适配器输出的标准化结构
2. **`GatewayRunner._handle_message()`** — 核心分发逻辑
3. **session key 生成** — platform + user + chat 三维隔离

---

## 常见误区

**误区 1**：不同平台需要不同的 AIAgent 类  
→ 同一个 `AIAgent` 类服务所有平台。平台差异完全封装在 adapter 里，AIAgent 只看 `MessageEvent.text`。

**误区 2**：session_key 只需要 user_id  
→ 需要三维（platform + user_id + chat_id）。同一个 Telegram 用户在不同群组里应该有独立的会话上下文。

**误区 3**：GatewayRunner 是一个 HTTP 服务器  
→ 不是。它是一个长运行进程（long-running process），通过各平台的 SDK/webhook 接收消息。HTTP 是各平台 SDK 的实现细节，对 GatewayRunner 透明。
