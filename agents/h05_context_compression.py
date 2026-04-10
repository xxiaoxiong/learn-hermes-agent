"""
h05 — Context Compression
═══════════════════════════════════════════════════════════════
coreAddition : ContextCompressor — preflight 检查 + middle turns 摘要
keyInsight   : 压缩不是删除历史——"中间摘要 + 保留最新 N 条"
               才是正确姿势；lineage_id 保证谱系可追溯

对应 Hermes 源码 : hermes-agent/run_agent.py → _compress_messages()
                  hermes-agent/agent/compression.py
═══════════════════════════════════════════════════════════════
"""
import json
import uuid
from dataclasses import dataclass
from openai import OpenAI
from config import BASE_URL, API_KEY, MODEL
from h02_tool_system import ToolRegistry, build_default_registry


# ── 压缩配置 ─────────────────────────────────────────────────────

@dataclass
class CompressionPolicy:
    """
    压缩策略参数。

    threshold_ratio : 当前 tokens / 模型最大 tokens 超过此比例时触发压缩
    protect_last_n  : 最新 N 条 messages 不参与压缩（保留近期上下文）
    approx_chars_per_token : 字符数 → token 数的粗估比例（避免依赖 tiktoken）
    model_max_tokens : 模型最大上下文长度（粗估用）
    """
    threshold_ratio: float = 0.5
    protect_last_n: int = 6
    approx_chars_per_token: float = 3.5
    model_max_tokens: int = 128_000


@dataclass
class CompressionResult:
    """压缩操作的结果"""
    compressed: bool           # 是否发生了压缩
    original_count: int        # 压缩前消息数
    new_count: int             # 压缩后消息数
    summary: str               # 生成的摘要（未压缩时为空）
    new_session_id: str        # 压缩后的新 session ID
    parent_session_id: str     # 原 session ID（谱系追踪）


class ContextCompressor:
    """
    对话上下文压缩器。

    压缩策略：
      1. preflight 检查：估算当前 messages 占模型上下文的比例
      2. 超过阈值 → 提取"中间段"消息（排除最新 protect_last_n 条）
      3. 调用同一个 LLM 将中间段压缩为一条摘要消息
      4. 用摘要替换中间段，保留最新 N 条 → 新的 messages 列表
      5. 生成新 session_id，记录 parent_session_id（压缩谱系）

    关键约束（对应 Hermes 源码中的实际逻辑）：
      - tool_call 和对应的 tool_result 必须成对保留，不能分开压缩
      - 至少保留 1 条 user 消息，避免 API 报"messages 为空"错误
    """

    def __init__(self, policy: CompressionPolicy | None = None):
        self.client = OpenAI(base_url=BASE_URL, api_key=API_KEY)
        self.policy = policy or CompressionPolicy()

    def estimate_tokens(self, messages: list[dict]) -> int:
        """按字符数粗估 token 数（生产环境应使用 tiktoken）"""
        total_chars = sum(len(json.dumps(m, ensure_ascii=False)) for m in messages)
        return int(total_chars / self.policy.approx_chars_per_token)

    def should_compress(self, messages: list[dict]) -> bool:
        """preflight 检查：是否需要压缩"""
        estimated_tokens = self.estimate_tokens(messages)
        threshold_tokens = self.policy.model_max_tokens * self.policy.threshold_ratio
        return estimated_tokens > threshold_tokens

    def _find_safe_split_point(self, messages: list[dict], target_idx: int) -> int:
        """
        找到安全的压缩边界：确保不在 tool_call/tool_result 对中间切断。

        tool_call (role=assistant, tool_calls=[...]) 和
        tool_result (role=tool) 必须成对出现，压缩边界不能插在两者之间。
        """
        # 向后搜索，直到找到一个完整对的末尾
        i = target_idx
        while i < len(messages):
            msg = messages[i]
            if msg.get("role") == "assistant" and msg.get("tool_calls"):
                # 跳过后续所有 tool_result（可能有多个）
                j = i + 1
                while j < len(messages) and messages[j].get("role") == "tool":
                    j += 1
                i = j  # 跳过整个 tool_call 组
            else:
                break
        return i

    def compress(
        self,
        messages: list[dict],
        session_id: str,
    ) -> tuple[list[dict], CompressionResult]:
        """
        执行压缩，返回压缩后的 messages 列表和压缩结果。

        压缩后的 messages 结构：
          [summary_message, ...protect_last_n 条原始消息]
        """
        n = len(messages)
        protect = self.policy.protect_last_n

        if n <= protect:
            # 消息太少，无需压缩
            return messages, CompressionResult(
                compressed=False, original_count=n, new_count=n,
                summary="", new_session_id=session_id,
                parent_session_id=session_id,
            )

        # 找到安全的压缩边界
        split_point = self._find_safe_split_point(messages, n - protect)
        middle_messages = messages[:split_point]
        recent_messages = messages[split_point:]

        if not middle_messages:
            return messages, CompressionResult(
                compressed=False, original_count=n, new_count=n,
                summary="", new_session_id=session_id,
                parent_session_id=session_id,
            )

        # 调用 LLM 生成摘要
        summary = self._summarize(middle_messages)

        # 构建压缩后的 messages
        summary_message = {
            "role": "user",
            "content": f"<compressed_history>\n{summary}\n</compressed_history>",
        }
        new_messages = [summary_message] + recent_messages

        # 生成新 session ID（谱系追踪）
        new_session_id = str(uuid.uuid4())[:8]

        return new_messages, CompressionResult(
            compressed=True,
            original_count=n,
            new_count=len(new_messages),
            summary=summary,
            new_session_id=new_session_id,
            parent_session_id=session_id,
        )

    def _summarize(self, messages: list[dict]) -> str:
        """调用 LLM 将一段对话历史压缩为摘要"""
        prompt_messages = [
            {
                "role": "user",
                "content": (
                    "请将以下对话历史压缩为简洁的摘要，保留关键信息、决策和结果。"
                    "摘要应足够完整，让后续对话能理解已发生的事情。\n\n"
                    f"对话历史：\n{json.dumps(messages, ensure_ascii=False, indent=2)}"
                ),
            }
        ]
        response = self.client.chat.completions.create(
            model=MODEL,
            messages=prompt_messages,
            max_tokens=500,
        )
        return response.choices[0].message.content or ""


class AIAgent:
    """
    h05 版 AIAgent：每轮 turn 开始前执行 preflight 压缩检查。

    与 h04 的差异：
      h04: messages 只增不减
      h05: 超过阈值时自动压缩，维护 session lineage
    """

    def __init__(
        self,
        registry: ToolRegistry | None = None,
        max_iterations: int = 15,
        compression_policy: CompressionPolicy | None = None,
    ):
        self.client = OpenAI(base_url=BASE_URL, api_key=API_KEY)
        self.registry = registry or build_default_registry()
        self.compressor = ContextCompressor(compression_policy)
        self.max_iterations = max_iterations
        self.messages: list[dict] = []
        self.session_id: str = str(uuid.uuid4())[:8]
        self.parent_session_id: str | None = None

    def run_conversation(self, user_message: str) -> str:
        self.messages.append({"role": "user", "content": user_message})

        for _ in range(self.max_iterations):
            # ── Preflight 压缩检查 ────────────────────────────────
            if self.compressor.should_compress(self.messages):
                self.messages, result = self.compressor.compress(
                    self.messages, self.session_id
                )
                if result.compressed:
                    self.parent_session_id = result.parent_session_id
                    self.session_id = result.new_session_id
                    print(f"[压缩] {result.original_count} → {result.new_count} 条消息"
                          f" | 新 session: {self.session_id}"
                          f" | 父 session: {self.parent_session_id}")

            response = self.client.chat.completions.create(
                model=MODEL,
                messages=self.messages,
                tools=self.registry.get_schemas(),
            )
            message = response.choices[0].message
            self.messages.append(message.model_dump(exclude_unset=True))

            if message.tool_calls:
                for tc in message.tool_calls:
                    args = json.loads(tc.function.arguments)
                    result_obj = self.registry.dispatch(tc.function.name, args)
                    self.messages.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": str(result_obj),
                    })
                continue

            return message.content or ""

        return f"[达到最大迭代次数 {self.max_iterations}]"


# ── 演示 ─────────────────────────────────────────────────────────
if __name__ == "__main__":
    # 使用低阈值触发压缩（生产环境通常设 0.5~0.8）
    policy = CompressionPolicy(threshold_ratio=0.001, protect_last_n=4)
    agent = AIAgent(compression_policy=policy)

    print("=== 开始对话（低阈值触发压缩演示）===")
    replies = [
        "什么是 agent loop？简短回答",
        "什么是 tool registry？简短回答",
        "什么是 context compression？简短回答",
    ]
    for q in replies:
        print(f"\n用户: {q}")
        print(f"Agent: {agent.run_conversation(q)[:100]}...")

    print(f"\n── 最终状态 ──")
    print(f"当前 session_id  : {agent.session_id}")
    print(f"父 session_id    : {agent.parent_session_id}")
    print(f"messages 数量    : {len(agent.messages)}")
