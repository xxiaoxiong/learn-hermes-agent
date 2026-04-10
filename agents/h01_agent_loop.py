"""
h01 — Agent Loop
═══════════════════════════════════════════════════════════════
coreAddition : while 循环 + tool_result 消息回流
keyInsight   : agent 不是"一问一答"——它是一个持续运行的循环，
               直到模型主动选择停止调用工具

对应 Hermes 源码 : hermes-agent/run_agent.py → AIAgent.run_conversation()
═══════════════════════════════════════════════════════════════
"""
import json
import subprocess
from openai import OpenAI
from config import BASE_URL, API_KEY, MODEL

# ── 工具定义（JSON Schema，供模型读取）────────────────────────────
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "bash",
            "description": "执行一条 shell 命令并返回标准输出与错误输出",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "要执行的 shell 命令"}
                },
                "required": ["command"],
            },
        },
    }
]


def run_bash(command: str) -> str:
    """工具的实际执行逻辑（handler）。
    
    注意区分：
      - TOOLS 里的 schema    → 给模型看，告诉模型这个工具能做什么、参数是什么
      - run_bash 函数         → 给代码执行，真正跑命令
    两者通过 name 字段绑定，h02 会把这个绑定关系抽象成 ToolRegistry。
    """
    result = subprocess.run(
        command, shell=True, capture_output=True, text=True, timeout=30
    )
    return result.stdout + result.stderr


class AIAgent:
    """
    最小 Hermes 风格 Agent。

    核心机制（turn lifecycle）：
      Step 1  用户消息追加到 messages
      Step 2  调用 API，拿到模型响应
      Step 3  把模型本轮输出追加到 messages（必须！否则 API 会报错）
      Step 4a 如果模型调用了工具 → 执行工具 → 追加 tool_result → 回到 Step 2
      Step 4b 如果模型直接回答  → 返回内容，结束循环

    对应 Hermes run_agent.py 的精简版：
      - AIAgent.__init__()       → 本类 __init__
      - AIAgent.run_conversation()→ 本类 run_conversation()
      - _dispatch_tool()         → 本类 _dispatch()
    """

    def __init__(self, max_iterations: int = 10):
        self.client = OpenAI(base_url=BASE_URL, api_key=API_KEY)
        self.max_iterations = max_iterations
        self.messages: list[dict] = []

    def run_conversation(self, user_message: str) -> str:
        """
        单次对话入口。

        keyInsight: messages 列表是 agent 的"工作记忆"——
        每一轮的 API 调用都会把完整历史发给模型，
        tool_result 消息让模型"看到"工具返回了什么，
        从而决定下一步行动（继续调工具 or 给出最终答案）。
        """
        self.messages.append({"role": "user", "content": user_message})

        for iteration in range(self.max_iterations):
            response = self.client.chat.completions.create(
                model=MODEL,
                messages=self.messages,
                tools=TOOLS,
            )
            message = response.choices[0].message

            # ⚠️ 关键：不管模型是调工具还是回答，都要先把本轮输出追加到 messages
            self.messages.append(message.model_dump(exclude_unset=True))

            # ── 分支 A：模型想调用工具 ──────────────────────────────
            if message.tool_calls:
                for tool_call in message.tool_calls:
                    result = self._dispatch(tool_call)
                    # tool_result 格式固定：role="tool" + tool_call_id 对应
                    self.messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": result,
                    })
                # 继续下一轮：让模型看到工具结果后决定下一步
                continue

            # ── 分支 B：模型直接回答，退出循环 ─────────────────────
            return message.content or ""

        return f"[达到最大迭代次数 {self.max_iterations}，任务中止]"

    def _dispatch(self, tool_call) -> str:
        """根据工具名路由到 handler（h02 将把这里替换成 ToolRegistry.dispatch()）"""
        name = tool_call.function.name
        args = json.loads(tool_call.function.arguments)
        if name == "bash":
            return run_bash(args["command"])
        return f"[未知工具: {name}]"


# ── 演示入口 ──────────────────────────────────────────────────────
if __name__ == "__main__":
    agent = AIAgent()
    reply = agent.run_conversation("列出当前目录的文件，然后告诉我今天是几号")
    print(reply)
