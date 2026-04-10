# h01 — Agent Loop：while 循环驱动的持续执行引擎

> **核心洞察**：agent 不是"一问一答"——它是一个持续运行的循环，直到模型主动选择停止调用工具。

---

## 问题：没有循环，会发生什么？

假设你直接调用一次 OpenAI API：

```python
response = client.chat.completions.create(
    model=MODEL,
    messages=[{"role": "user", "content": "列出当前目录的文件"}],
    tools=TOOLS,
)
```

模型会返回一个 `tool_call`（调用 `bash` 工具），告诉你它想执行 `ls`。  
**但什么也不会发生**。模型只是表达了意图，真正的执行在你这里。

如果你不把工具结果发回给模型，它永远不知道命令执行了什么，也无法做出下一步决策。

这就是 agent 循环存在的原因。

---

## 核心机制：消息列表的闭环

Hermes agent 循环的本质是：**把工具结果持续追加到 `messages` 列表，让模型在完整上下文下做决策**。

```
┌─────────────────────────────────────────────┐
│                 messages 列表                 │
│  [user msg] → [assistant tool_call] → ...   │
│             ← [tool result] ←               │
└─────────────────────────────────────────────┘
        ↓ 发给 API              ↑ 追加回来
   模型响应                   工具执行结果
```

### Turn Lifecycle（6 步）

```
Step 1  用户消息追加到 messages
Step 2  完整 messages 发给 API → 拿到模型响应
Step 3  把模型本轮输出追加到 messages（⚠️ 必须，否则 API 会报错）
Step 4a 如果 response 包含 tool_calls → 执行每个工具
Step 4b 工具结果追加为 role="tool" 消息 → 回到 Step 2
Step 5  如果 response 没有 tool_calls → 返回内容，结束循环
```

---

## 关键数据结构

### messages 列表

```python
messages = [
    {"role": "user", "content": "列出当前目录的文件"},
    
    # 模型调用工具（Step 3 追加）
    {
        "role": "assistant",
        "tool_calls": [{
            "id": "call_abc123",
            "type": "function",
            "function": {"name": "bash", "arguments": '{"command": "ls -la"}'}
        }]
    },
    
    # 工具结果（Step 4b 追加）
    {
        "role": "tool",
        "tool_call_id": "call_abc123",   # ← 必须与 tool_call.id 对应
        "content": "total 32\ndrwxr-xr-x ..."
    },
    
    # 模型最终回答（loop 结束）
    {"role": "assistant", "content": "当前目录包含以下文件：..."}
]
```

**注意**：`tool_call_id` 是 tool_call 和 tool_result 的配对键。如果 ID 不匹配，API 会报错。

### LoopState（迭代控制）

```python
class AIAgent:
    def __init__(self, max_iterations: int = 10):
        self.max_iterations = max_iterations  # 预算上限：防止无限循环
        self.messages: list[dict] = []         # 工作记忆
```

`max_iterations` 是保底安全机制。正常情况下，模型自己会在任务完成后停止调用工具（不再返回 `tool_calls`），循环自然退出。

---

## 代码解读：h01_agent_loop.py

### 工具定义（schema）

```python
TOOLS = [{
    "type": "function",
    "function": {
        "name": "bash",
        "description": "执行一条 shell 命令并返回输出",
        "parameters": {
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "要执行的 shell 命令"}
            },
            "required": ["command"],
        },
    },
}]
```

这是给**模型**看的说明书。模型看到 `name`, `description`, `parameters`，决定是否调用、传什么参数。

`run_bash()` 函数是给**代码**执行的 handler。两者通过 `name = "bash"` 绑定。h02 会把这个绑定关系抽象成 `ToolRegistry`。

### 主循环

```python
def run_conversation(self, user_message: str) -> str:
    self.messages.append({"role": "user", "content": user_message})

    for iteration in range(self.max_iterations):
        response = self.client.chat.completions.create(
            model=MODEL,
            messages=self.messages,
            tools=TOOLS,
        )
        message = response.choices[0].message

        # ⚠️ 关键：先追加本轮输出，再判断分支
        self.messages.append(message.model_dump(exclude_unset=True))

        if message.tool_calls:          # 分支 A：执行工具，继续循环
            for tool_call in message.tool_calls:
                result = self._dispatch(tool_call)
                self.messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": result,
                })
            continue

        return message.content or ""    # 分支 B：直接回答，退出循环

    return f"[达到最大迭代次数 {self.max_iterations}，任务中止]"
```

---

## 与 Hermes 真实代码的对应

| 教学实现 | Hermes 源码 | 说明 |
|---|---|---|
| `AIAgent.run_conversation()` | `run_agent.py: AIAgent.run_conversation()` | 结构完全对应 |
| `self.messages` | `self.messages` | 相同字段名 |
| `max_iterations` | `IterationBudget` 类 | Hermes 更复杂：支持父子 agent 共享预算 |
| `_dispatch()` 里的 if-else | `ToolRegistry.dispatch()` | h02 会抽象成注册表 |
| `tool_call_id` 配对 | 相同机制 | OpenAI API 规范要求 |

Hermes 的 `run_agent.py` 在此基础上增加了：预算共享、fallback provider、context 压缩触发、memory flush、todo 拦截等。这些在后续章节逐一引入。

---

## 常见误区

**误区 1**："模型在思考"时 agent 在等待  
→ 模型返回 `tool_calls` 只是表达意图，真正的"行动"发生在你的代码执行工具时。循环才是 agent 的行动机制。

**误区 2**：`tool_calls` 为空 = 模型出错了  
→ `tool_calls` 为 `None` 或空列表是正常的：模型认为任务完成，直接给出文本回答，这就是退出条件。

**误区 3**：每次对话都应该重置 messages  
→ `messages` 是对话历史，同一个 session 内应保持连续。跨 session 的隔离由 h06 的 `SessionDB` 管理。

---

## 动手练习

1. 运行 `python agents/h01_agent_loop.py`，观察循环次数与工具调用过程
2. 把 `max_iterations` 改成 `2`，给 agent 一个需要多步工具调用的任务，观察提前中止时的输出
3. 在 `run_conversation` 里打印 `iteration` 和 `len(self.messages)`，理解每轮循环中 messages 的增长规律
