# h03 — Planning & Todos：agent-level tool 拦截 + 任务状态追踪

> **核心洞察**：todo 不是普通工具——它修改的是 agent 自身执行状态，在 ToolRegistry dispatch **之前**被主循环拦截处理。

---

## 问题：agent 处理复杂任务会"迷路"

给 h02 版 agent 一个多步任务：

> "帮我：1. 检查 Python 版本，2. 列出当前目录文件，3. 统计 .py 文件数量，4. 生成一份报告写入 report.txt"

没有 todo 工具时，agent 可能：
- 做到一半忘记还有后续步骤
- 重复做某个步骤
- 做完后不知道整体进度

人类处理复杂任务时会写 TODO 列表。agent 也应该有这个能力。

---

## 关键概念：agent-level tool 拦截

`todo` 工具与 `read_file`、`bash` 的本质区别：

| | 普通工具（bash、read_file…） | agent-level tool（todo） |
|---|---|---|
| 作用对象 | 外部系统（OS、文件、网络） | agent 自身状态（PlanState） |
| 处理位置 | `ToolRegistry.dispatch()` | 主循环在 `dispatch()` **之前**拦截 |
| 失败影响 | 返回 `[ERROR]` 字符串给模型 | 影响 agent 对自身进度的认知 |

Hermes 的 `run_agent.py` 在调用 `registry.dispatch()` 之前，先检查工具名是否为 `todo`（以及其他 agent-level tools 如 `session_search`、`memory_write`）。

```python
# 主循环中的拦截逻辑（简化）
for tool_call in message.tool_calls:
    name = tool_call.function.name
    args = json.loads(tool_call.function.arguments)

    # ← agent-level 工具先拦截
    if name == "todo":
        result = self._handle_todo(args)
    else:
        # 普通工具走注册表
        result = self.registry.dispatch(name, args)
```

---

## 关键数据结构

### TodoItem

```python
from dataclasses import dataclass, field
from enum import Enum

class TodoStatus(Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    DONE = "done"

@dataclass
class TodoItem:
    id: str
    description: str
    status: TodoStatus = TodoStatus.PENDING
```

### PlanState

```python
@dataclass
class PlanState:
    todos: list[TodoItem] = field(default_factory=list)
    _id_counter: int = 0

    def create(self, description: str) -> TodoItem: ...
    def update(self, todo_id: str, status: TodoStatus) -> str: ...
    def complete(self, todo_id: str) -> str: ...
    def list_all(self) -> str: ...
```

**重点**：`PlanState` 存在 `AIAgent` 实例属性上（`self.plan = PlanState()`），而不是 messages 里，也不在数据库里。这意味着：

- 压缩 messages 不会丢失 todo 列表
- 同一个 agent 实例的多轮对话共享同一个 PlanState
- 跨 session 恢复需要另外处理（Hermes 用 SQLite 持久化）

---

## 工具的四个操作

```python
# todo 工具支持的 action
{
    "action": "create",   "description": "检查 Python 版本"
}
{
    "action": "update",   "id": "todo-1", "status": "in_progress"
}
{
    "action": "complete", "id": "todo-1"
}
{
    "action": "list"
}
```

对应 schema 设计：

```python
TODO_SCHEMA = {
    "name": "todo",
    "description": "管理任务列表，追踪执行进度",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["create", "update", "complete", "list"],
            },
            "description": {"type": "string"},
            "id": {"type": "string"},
            "status": {
                "type": "string",
                "enum": ["pending", "in_progress", "done"],
            },
        },
        "required": ["action"],
    },
}
```

---

## system prompt 中声明 todo 工具

```python
SYSTEM_PROMPT = """你是一个 AI 助手。

对于复杂任务，请遵循以下流程：
1. 先用 todo 工具创建任务列表，分解目标
2. 逐步执行，每开始一项时将其标记为 in_progress
3. 完成后标记为 done
4. 随时可以用 todo list 查看整体进度"""
```

这段 prompt 告诉模型何时、如何使用 todo 工具。模型不是自动知道要这样做的——这是 system prompt 的职责。

---

## 与 Hermes 真实代码的对应

Hermes 的 todo 工具实际上更复杂：

| 教学实现 | Hermes 源码 | 差异 |
|---|---|---|
| `PlanState`（内存） | `hermes_state.py` 中的 todo 表（SQLite） | Hermes 持久化到数据库 |
| 4 个操作 | 相同的 4 个操作 | 接口一致 |
| 主循环中拦截 | `run_agent.py` 中的 agent-level 检查 | 相同模式 |

Hermes 还有其他 agent-level tools：
- `session_search`：搜索历史会话（h06）
- `memory_write`：写入持久记忆（h07）

所有这些都在 `ToolRegistry.dispatch()` 之前被主循环拦截。

---

## 常见误区

**误区 1**：todo 工具可以像其他工具一样注册到 ToolRegistry  
→ 可以注册，但如果处理逻辑在 handler 里而不是主循环里，agent 的 PlanState 就变成了一个外部服务，失去了"自我感知"的能力。Hermes 的设计是：拦截在主循环，状态在 agent 实例上。

**误区 2**：模型会自动使用 todo 工具  
→ 不会。必须在 system prompt 里明确说明何时使用，以及任务的分解流程。

**误区 3**：PlanState 和 messages 一起被压缩  
→ PlanState 在 agent 实例属性上，messages 压缩不影响它。这是刻意的设计：任务追踪状态应该比会话内容更持久。

---

## 动手练习

1. 运行 `python agents/h03_planning_todos.py`，给 agent 一个 3-4 步骤的任务，观察 todo 创建和更新的时序
2. 在 `_handle_todo()` 里打印当前 todo 列表，观察每次工具调用后状态的变化
3. 修改 system prompt，去掉 todo 的使用说明，观察模型是否还会自发使用 todo 工具
