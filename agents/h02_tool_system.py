"""
h02 — Tool System
═══════════════════════════════════════════════════════════════
coreAddition : ToolRegistry — 注册表统一管理 schema 与 handler
keyInsight   : tool schema 是给模型的说明书，handler 是给代码的
               执行器——两者分离，才能"不改主循环添新工具"

对应 Hermes 源码 : hermes-agent/tools/registry.py → ToolRegistry
═══════════════════════════════════════════════════════════════
"""
import json
import subprocess
from typing import Callable
from openai import OpenAI
from config import BASE_URL, API_KEY, MODEL


class ToolResult:
    """工具执行结果的统一封装，确保错误信息以字符串形式回流给模型"""

    def __init__(self, success: bool, content: str):
        self.success = success
        self.content = content

    def __str__(self) -> str:
        prefix = "" if self.success else "[ERROR] "
        return prefix + self.content


class ToolRegistry:
    """
    工具注册表：schema（给模型）与 handler（给代码）的统一管理中心。

    工作流程：
      1. 调用 register() 一次性绑定 schema + handler
      2. 主循环调 get_schemas() → 传给 API 的 tools 参数
      3. 模型决定调某个工具 → 主循环调 dispatch(name, args) 执行

    扩展工具只需：registry.register("new_tool", schema, handler)
    主循环代码完全不动。
    """

    def __init__(self):
        self._handlers: dict[str, Callable] = {}
        self._schemas: dict[str, dict] = {}

    def register(self, name: str, schema: dict, handler: Callable) -> None:
        """注册一个工具，绑定 schema 和 handler"""
        self._schemas[name] = {"type": "function", "function": schema}
        self._handlers[name] = handler

    def get_schemas(self) -> list[dict]:
        """返回所有工具的 JSON Schema 列表（直接传给 API 的 tools 参数）"""
        return list(self._schemas.values())

    def dispatch(self, name: str, args: dict) -> ToolResult:
        """
        执行指定工具，捕获所有异常。

        注意：工具异常不应打断主循环——失败结果以 [ERROR] 字符串
        回流给模型，让模型决定如何处理（重试/报告/换方案）。
        """
        if name not in self._handlers:
            return ToolResult(success=False, content=f"未知工具: {name}")
        try:
            result = self._handlers[name](**args)
            return ToolResult(success=True, content=str(result))
        except Exception as e:
            return ToolResult(success=False, content=f"工具执行失败: {e}")


# ── 内置工具 handlers ────────────────────────────────────────────

def _read_file(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def _write_file(path: str, content: str) -> str:
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    return f"已写入 {path}"


def _run_command(command: str) -> str:
    result = subprocess.run(
        command, shell=True, capture_output=True, text=True, timeout=30
    )
    return result.stdout + result.stderr


def build_default_registry() -> ToolRegistry:
    """创建包含默认三个工具的注册表"""
    r = ToolRegistry()

    r.register("read_file", {
        "name": "read_file",
        "description": "读取本地文件内容",
        "parameters": {
            "type": "object",
            "properties": {"path": {"type": "string", "description": "文件路径"}},
            "required": ["path"],
        },
    }, _read_file)

    r.register("write_file", {
        "name": "write_file",
        "description": "将内容写入本地文件（覆盖）",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "目标文件路径"},
                "content": {"type": "string", "description": "要写入的内容"},
            },
            "required": ["path", "content"],
        },
    }, _write_file)

    r.register("run_command", {
        "name": "run_command",
        "description": "执行 shell 命令并返回输出",
        "parameters": {
            "type": "object",
            "properties": {"command": {"type": "string", "description": "shell 命令"}},
            "required": ["command"],
        },
    }, _run_command)

    return r


class AIAgent:
    """
    h02 版 AIAgent：主循环不再硬编码工具，委托 ToolRegistry 处理。

    与 h01 的唯一差异：
      h01: _dispatch() 里写死 if name == "bash": ...
      h02: _dispatch() 调用 registry.dispatch(name, args)
    主循环代码一行未变。
    """

    def __init__(self, registry: ToolRegistry | None = None, max_iterations: int = 10):
        self.client = OpenAI(base_url=BASE_URL, api_key=API_KEY)
        self.registry = registry or build_default_registry()
        self.max_iterations = max_iterations
        self.messages: list[dict] = []

    def run_conversation(self, user_message: str) -> str:
        self.messages.append({"role": "user", "content": user_message})

        for _ in range(self.max_iterations):
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
                    result = self.registry.dispatch(tc.function.name, args)
                    self.messages.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": str(result),
                    })
                continue

            return message.content or ""

        return f"[达到最大迭代次数 {self.max_iterations}]"


# ── 演示：动态添加工具，不改主循环 ────────────────────────────────
if __name__ == "__main__":
    import datetime

    registry = build_default_registry()

    # ← 添加新工具只需 3 行，主循环代码完全不动
    registry.register(
        "get_time",
        {"name": "get_time", "description": "返回当前时间",
         "parameters": {"type": "object", "properties": {}}},
        lambda: datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    )

    agent = AIAgent(registry=registry)
    print(agent.run_conversation("现在几点了？然后把 'hello world' 写入 /tmp/test.txt"))
