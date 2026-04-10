"""
h04 — Prompt Assembly
═══════════════════════════════════════════════════════════════
coreAddition : PromptBuilder — 5 类 section 按优先级动态组装
keyInsight   : system prompt 不是一次性写死的字符串——它是运行时
               根据文件是否存在、内存是否有内容动态构建的

对应 Hermes 源码 : hermes-agent/agent/prompt_builder.py → PromptBuilder
═══════════════════════════════════════════════════════════════
"""
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable
from openai import OpenAI
from config import BASE_URL, API_KEY, MODEL
from h02_tool_system import ToolRegistry, build_default_registry


# ── Section 数据结构 ─────────────────────────────────────────────

@dataclass
class PromptSection:
    """
    system prompt 的一个组成片段。

    name     : 片段名称（用于调试和日志）
    content  : 片段内容（字符串）
    priority : 数字越小优先级越高，组装时按升序排列
    condition: 可选谓词，返回 False 时跳过此片段（如文件不存在）
    """
    name: str
    content: str
    priority: int = 50
    condition: Callable[[], bool] = field(default_factory=lambda: (lambda: True))


class PromptBuilder:
    """
    动态 system prompt 构建器。

    Hermes 的 5 层 section 来源（优先级从高到低）：
      1. personality   — SOUL.md（persona / 人格设定）
      2. memory        — MEMORY.md + USER.md（跨会话记忆）
      3. skills        — skill 文件注入（操作指南）
      4. context_files — AGENTS.md / .hermes.md（项目上下文）
      5. tool_guidance — 工具使用说明（动态生成）

    为什么要分层？
      - 修改 memory 内容不影响 personality 在 prompt 中的位置
      - 关闭 skill 注入只需移除对应 section，不影响其他层
      - Anthropic prompt caching 要求 system prompt 前半部分稳定——
        高优先级的 personality/memory 内容不变，cache 命中率更高
    """

    def __init__(self):
        self._sections: list[PromptSection] = []

    def add_section(
        self,
        name: str,
        content: str,
        priority: int = 50,
        condition: Callable[[], bool] | None = None,
    ) -> "PromptBuilder":
        """添加一个 prompt section，支持链式调用"""
        self._sections.append(
            PromptSection(
                name=name,
                content=content,
                priority=priority,
                condition=condition or (lambda: True),
            )
        )
        return self

    def build(self) -> str:
        """
        按优先级升序组装所有满足 condition 的 section。
        各 section 之间以双换行分隔，保持可读性。
        """
        active = [s for s in self._sections if s.condition()]
        active.sort(key=lambda s: s.priority)
        return "\n\n".join(s.content for s in active)

    def debug(self) -> list[dict]:
        """返回每个 section 的状态，便于调试"""
        result = []
        for s in sorted(self._sections, key=lambda x: x.priority):
            result.append({
                "name": s.name,
                "priority": s.priority,
                "active": s.condition(),
                "length": len(s.content),
            })
        return result


# ── 工厂函数：从文件系统构建默认 PromptBuilder ───────────────────

def build_prompt_for_agent(
    soul_path: str = "SOUL.md",
    memory_path: str = "MEMORY.md",
    skill_paths: list[str] | None = None,
    agents_md_path: str = "AGENTS.md",
    tool_names: list[str] | None = None,
) -> PromptBuilder:
    """
    从文件系统读取各类上下文，构建 PromptBuilder 实例。

    演示 condition 控制：
      - 文件不存在 → condition 返回 False → 该 section 被跳过
      - 这保证了 prompt 结构的确定性（不因文件缺失而报错）
    """
    builder = PromptBuilder()

    # ── Layer 1: Personality（优先级最高，最稳定，保障 cache 命中）──
    soul = Path(soul_path)
    builder.add_section(
        name="personality",
        content=soul.read_text(encoding="utf-8") if soul.exists() else
                "你是一个专业、简洁、可信赖的 AI 助手。",
        priority=10,
    )

    # ── Layer 2: Memory（跨会话记忆）────────────────────────────────
    memory = Path(memory_path)
    builder.add_section(
        name="memory",
        content=f"<memory>\n{memory.read_text(encoding='utf-8')}\n</memory>",
        priority=20,
        condition=memory.exists,  # 文件不存在时跳过
    )

    # ── Layer 3: Skills（操作指南，以 user message 注入——此处为简化版）
    for i, skill_path in enumerate(skill_paths or []):
        p = Path(skill_path)
        if p.exists():
            builder.add_section(
                name=f"skill_{p.stem}",
                content=f"<skill name='{p.stem}'>\n{p.read_text(encoding='utf-8')}\n</skill>",
                priority=30 + i,
            )

    # ── Layer 4: Context files（项目上下文）──────────────────────────
    agents_md = Path(agents_md_path)
    builder.add_section(
        name="context_files",
        content=f"<context>\n{agents_md.read_text(encoding='utf-8')}\n</context>",
        priority=40,
        condition=agents_md.exists,
    )

    # ── Layer 5: Tool guidance（动态生成，每次重建）─────────────────
    if tool_names:
        names_str = ", ".join(f"`{n}`" for n in tool_names)
        builder.add_section(
            name="tool_guidance",
            content=f"你可以使用以下工具：{names_str}。优先使用工具完成任务，再给出文字总结。",
            priority=50,
        )

    return builder


class AIAgent:
    """
    h04 版 AIAgent：system prompt 由 PromptBuilder 每轮动态构建。

    与 h03 的差异：
      h03: system prompt 是硬编码字符串 + todo 状态拼接
      h04: 全部委托 PromptBuilder，增减内容只需 add_section()
    """

    def __init__(self, registry: ToolRegistry | None = None, max_iterations: int = 15):
        self.client = OpenAI(base_url=BASE_URL, api_key=API_KEY)
        self.registry = registry or build_default_registry()
        self.max_iterations = max_iterations
        self.messages: list[dict] = []
        # PromptBuilder 在 agent 初始化时构建，后续可热更新 section
        self.prompt_builder = build_prompt_for_agent(
            tool_names=list(self.registry._schemas.keys())
        )

    def run_conversation(self, user_message: str) -> str:
        self.messages.append({"role": "user", "content": user_message})

        for _ in range(self.max_iterations):
            system_prompt = self.prompt_builder.build()  # 每轮重建
            response = self.client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    *self.messages,
                ],
                tools=self.registry.get_schemas(),
            )
            message = response.choices[0].message
            self.messages.append(message.model_dump(exclude_unset=True))

            if message.tool_calls:
                for tc in message.tool_calls:
                    args = json.loads(tc.function.arguments)
                    result = self.registry.dispatch(tc.function.name, args)
                    self.messages.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": str(result),
                    })
                continue

            return message.content or ""

        return f"[达到最大迭代次数 {self.max_iterations}]"


# ── 演示 ─────────────────────────────────────────────────────────
if __name__ == "__main__":
    builder = build_prompt_for_agent(tool_names=["read_file", "run_command"])

    print("── PromptBuilder 调试信息 ──")
    for s in builder.debug():
        status = "✓" if s["active"] else "✗ (跳过)"
        print(f"  [{s['priority']:2d}] {s['name']:<20} {status}  ({s['length']} chars)")

    print("\n── 构建出的 System Prompt（前 300 字符）──")
    print(builder.build()[:300])
