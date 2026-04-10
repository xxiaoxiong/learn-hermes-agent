"""
h03 — Planning & Todos
═══════════════════════════════════════════════════════════════
coreAddition : agent-level tool 拦截 + TodoList 状态跟踪
keyInsight   : todo 不是普通工具——它在 ToolRegistry dispatch
               之前被主循环拦截，因为它修改的是 agent 自身的
               执行状态，而不是外部世界

对应 Hermes 源码 : hermes-agent/run_agent.py → _handle_agent_tools()
                  hermes-agent/tools/todo_tool.py
═══════════════════════════════════════════════════════════════
"""
import json
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Literal
from openai import OpenAI
from config import BASE_URL, API_KEY, MODEL

# 复用 h02 的 ToolRegistry（在实际 Hermes 中也是同一个注册表）
from h02_tool_system import ToolRegistry, build_default_registry


# ── Todo 数据结构 ────────────────────────────────────────────────

class TodoStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    DONE = "done"


@dataclass
class TodoItem:
    id: str
    description: str
    status: TodoStatus = TodoStatus.PENDING

    def to_dict(self) -> dict:
        return {"id": self.id, "description": self.description, "status": self.status.value}


class PlanState:
    """
    Agent 的规划状态，存储在 agent 实例上，而非数据库。

    关键特性：
      - 不随 messages 压缩丢失（压缩只操作 messages 列表）
      - 每次 turn 开始前自动注入到 system prompt，让模型感知当前进度
    """

    def __init__(self):
        self._todos: dict[str, TodoItem] = {}

    def create(self, description: str) -> str:
        todo_id = str(uuid.uuid4())[:8]
        self._todos[todo_id] = TodoItem(id=todo_id, description=description)
        return todo_id

    def update(self, todo_id: str, status: str) -> str:
        if todo_id not in self._todos:
            return f"[ERROR] todo {todo_id} 不存在"
        self._todos[todo_id].status = TodoStatus(status)
        return f"已更新 {todo_id} → {status}"

    def complete(self, todo_id: str) -> str:
        return self.update(todo_id, TodoStatus.DONE.value)

    def list_todos(self) -> str:
        if not self._todos:
            return "（当前没有 todo）"
        lines = []
        icons = {TodoStatus.PENDING: "○", TodoStatus.IN_PROGRESS: "◑", TodoStatus.DONE: "●"}
        for item in self._todos.values():
            lines.append(f"{icons[item.status]} [{item.id}] {item.description}")
        return "\n".join(lines)

    def to_prompt_block(self) -> str:
        """生成注入 system prompt 的 todo 状态块"""
        return f"<current_todos>\n{self.list_todos()}\n</current_todos>"


# ── Todo 工具的 JSON Schema（供模型读取）────────────────────────

TODO_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "todo",
        "description": "管理当前任务的 todo 列表，用于追踪多步骤任务的执行进度",
        "parameters": {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["create", "update", "complete", "list"],
                    "description": "操作类型",
                },
                "description": {
                    "type": "string",
                    "description": "todo 描述（create 时必填）",
                },
                "todo_id": {
                    "type": "string",
                    "description": "todo ID（update/complete 时必填）",
                },
                "status": {
                    "type": "string",
                    "enum": ["pending", "in_progress", "done"],
                    "description": "新状态（update 时必填）",
                },
            },
            "required": ["action"],
        },
    },
}


class AIAgent:
    """
    h03 版 AIAgent：在主循环中加入 agent-level tool 拦截。

    与 h02 的差异：
      主循环在 registry.dispatch() 之前先检查工具名——
      如果是 "todo"，直接调用 plan_state 处理，不进入 registry。

    为什么要这样？
      - todo 操作修改的是 agent 自身状态（PlanState）
      - registry 里的工具操作的是外部世界（文件/命令/API）
      - 两类操作的错误处理、日志、权限检查逻辑不同

    Hermes 里同样被拦截的 agent-level tools：
      todo / memory / session_search
    """

    def __init__(self, registry: ToolRegistry | None = None, max_iterations: int = 15):
        self.client = OpenAI(base_url=BASE_URL, api_key=API_KEY)
        self.registry = registry or build_default_registry()
        self.plan_state = PlanState()
        self.max_iterations = max_iterations
        self.messages: list[dict] = []

    def _build_system_prompt(self) -> str:
        base = "你是一个能分解任务并逐步执行的 AI 助手。遇到多步骤任务时，先用 todo 工具列出所有步骤，再逐一执行。"
        todo_block = self.plan_state.to_prompt_block()
        return f"{base}\n\n{todo_block}"

    def _handle_todo(self, args: dict) -> str:
        """Agent-level tool 处理器——直接操作 PlanState，不经过 registry"""
        action = args.get("action")
        if action == "create":
            todo_id = self.plan_state.create(args["description"])
            return f"已创建 todo [{todo_id}]: {args['description']}"
        elif action == "update":
            return self.plan_state.update(args["todo_id"], args["status"])
        elif action == "complete":
            return self.plan_state.complete(args["todo_id"])
        elif action == "list":
            return self.plan_state.list_todos()
        return f"[ERROR] 未知 action: {action}"

    def run_conversation(self, user_message: str) -> str:
        self.messages.append({"role": "user", "content": user_message})

        # 所有工具 = registry 工具 + todo agent-level 工具
        all_tools = self.registry.get_schemas() + [TODO_TOOL_SCHEMA]

        for _ in range(self.max_iterations):
            response = self.client.chat.completions.create(
                model=MODEL,
                # system prompt 每轮重建，确保包含最新 todo 状态
                messages=[
                    {"role": "system", "content": self._build_system_prompt()},
                    *self.messages,
                ],
                tools=all_tools,
            )
            message = response.choices[0].message
            self.messages.append(message.model_dump(exclude_unset=True))

            if message.tool_calls:
                for tc in message.tool_calls:
                    args = json.loads(tc.function.arguments)
                    name = tc.function.name

                    # ── Agent-level tool 拦截（在 registry 之前）──────────
                    if name == "todo":
                        result = self._handle_todo(args)
                    else:
                        result = str(self.registry.dispatch(name, args))

                    self.messages.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": result,
                    })
                continue

            return message.content or ""

        return f"[达到最大迭代次数 {self.max_iterations}]"


# ── 演示 ─────────────────────────────────────────────────────────
if __name__ == "__main__":
    agent = AIAgent()
    reply = agent.run_conversation(
        "帮我完成以下任务：1) 创建 /tmp/hello.txt 写入 hello; "
        "2) 创建 /tmp/world.txt 写入 world; "
        "3) 合并两个文件内容写入 /tmp/merged.txt"
    )
    print("\n── 最终回答 ──")
    print(reply)
    print("\n── Todo 状态 ──")
    print(agent.plan_state.list_todos())
