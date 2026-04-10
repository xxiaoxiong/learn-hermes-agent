# Data Structures（核心数据结构速查）

> 学习 Hermes Agent，最容易迷路的地方往往不是功能太多，而是不知道“状态到底放在哪里”。这份文档把主线章节里反复出现的关键数据结构集中整理成一张状态地图，帮助你把 19 章重新拼成一个整体。

---

## 推荐怎么读这份文档

建议把它当成“状态索引页”来用，而不是从头到尾硬背：

- 如果你先是词不懂，回 [`glossary.md`](./glossary.md)
- 如果你先是不清楚章节边界，回 [`h00-architecture-overview.md`](./h00-architecture-overview.md)
- 如果你在 `h05` / `h06` / `h07` 之间混淆，重点看“上下文、session、memory”三组结构
- 如果你在 `h08` / `h17` / `h18` 之间混淆，重点看“skill、tool registry、plugin、MCP”四组结构

---

## 先记住两个总原则

### 原则 1：区分“内容状态”和“流程状态”

- `messages`、memory 正文、skill 文本，属于内容状态
- `turn_count`、todo status、permission decision、fallback chain，属于流程状态

很多初学者会把这两类东西混在一起，于是就很难理解为什么一个 agent 系统既需要消息历史，也需要控制状态。

### 原则 2：区分“持久状态”和“运行时状态”

- session、memory 文件、cron job、持久化配置，属于持久状态
- 当前工具调用、当前审批结果、当前 provider fallback 选择，属于运行时状态

这条边界一旦清楚，很多“这个东西为什么不直接放进 messages 里”的问题就自然能回答了。

---

## 1. 对话主线结构

### Message

作用：保存一条对话消息。

最小形状：

```python
message = {
    "role": "user" | "assistant" | "tool",
    "content": "...",
}
```

在更完整的 agent loop 里，它还可能包含：

- 结构化文本块
- tool call 信息
- tool result 信息

相关章节：

- `h01`
- `h02`
- `h05`
- `h06`

### Messages

作用：保存整个会话过程中当前仍在上下文窗口里的消息列表。

最小形状：

```python
messages = [message1, message2, message3]
```

它是 agent 当前最重要的工作记忆，但不是长期存档。

相关章节：

- `h01`
- `h05`
- `h06`

### ToolCall

作用：描述模型想调用哪个工具、传什么参数。

最小形状：

```python
tool_call = {
    "id": "call_123",
    "name": "read_file",
    "arguments": {"path": "notes.txt"},
}
```

它的意义是把“模型的意图”变成“代码可以 dispatch 的结构”。

相关章节：

- `h01`
- `h02`

### ToolResult

作用：把工具执行结果重新写回对话主线。

最小形状：

```python
tool_result = {
    "role": "tool",
    "tool_call_id": "call_123",
    "content": "file content...",
}
```

它的关键作用不是给用户看，而是让模型在下一轮继续基于真实执行结果思考。

相关章节：

- `h01`
- `h02`

### LoopState

作用：记录主循环当前执行到了哪一步。

最小形状：

```python
loop_state = {
    "iteration": 3,
    "max_iterations": 12,
    "stopped": False,
}
```

它属于流程状态，不属于业务内容。

相关章节：

- `h01`

---

## 2. 工具系统结构

### ToolSchema

作用：告诉模型这个工具叫什么、做什么、需要什么输入。

最小形状：

```python
tool_schema = {
    "name": "write_file",
    "description": "Write text to a file",
    "parameters": {
        "type": "object",
        "properties": {
            "path": {"type": "string"},
            "content": {"type": "string"},
        },
    },
}
```

它是给模型看的说明书，不是给 handler 直接执行的代码。

相关章节：

- `h02`

### ToolHandler

作用：真正执行工具逻辑的代码入口。

最小形状：

```python
def write_file(path: str, content: str) -> str:
    ...
```

和 schema 分离之后，工具系统才容易扩展。

相关章节：

- `h02`

### ToolRegistry

作用：统一登记 schema 和 handler，并按工具名 dispatch。

最小形状：

```python
registry = {
    "write_file": {
        "schema": tool_schema,
        "handler": write_file,
    }
}
```

真正的价值是：

- 新工具只注册一次
- 主循环不需要跟着变

相关章节：

- `h02`
- `h17`
- `h18`

### Dispatch Map

作用：按名字把工具请求路由到对应 handler。

最小形状：

```python
dispatch_map = {
    "read_file": read_file,
    "write_file": write_file,
    "bash": run_command,
}
```

你可以把它理解为 registry 的核心执行面。

相关章节：

- `h02`

---

## 3. 规划与执行状态

### TodoItem

作用：描述 plan 中的单个步骤。

最小形状：

```python
todo_item = {
    "id": "todo_1",
    "content": "Inspect bridge-docs metadata",
    "status": "in_progress",
}
```

它让 agent 对自己的工作进度有显式表示。

相关章节：

- `h03`

### PlanState

作用：保存当前活跃的 todo 列表。

最小形状：

```python
plan_state = {
    "items": [todo_item1, todo_item2],
}
```

关键点在于：它属于 agent 内部执行状态，而不是普通外部工具结果。

相关章节：

- `h03`

### Agent-level Tool State

作用：保存需要由主循环优先处理的内部状态变更。

最小形状：

```python
agent_state = {
    "plan_state": plan_state,
}
```

它的存在解释了为什么 `todo` 不是普通 registry tool。

相关章节：

- `h03`

---

## 4. Prompt 组装结构

### PromptSection

作用：表示 system prompt 的一个可独立管理片段。

最小形状：

```python
section = {
    "name": "memory",
    "content": "...",
    "priority": 30,
    "enabled": True,
}
```

它的价值在于 prompt 不再是一整段难以维护的大字符串。

相关章节：

- `h04`

### PromptBuilder

作用：按顺序和条件组装多个 prompt section。

最小形状：

```python
builder = {
    "sections": [section1, section2, section3],
}
```

它让 prompt 的结构具备明确边界和优先级。

相关章节：

- `h04`

### PromptSources

作用：表示 prompt 片段来自哪些来源。

最典型的来源包括：

- personality
- memory
- skills
- context files
- tool guidance

这不是一个固定类名，而是一种理解 prompt 结构的分类视角。

相关章节：

- `h04`
- `h07`
- `h08`

---

## 5. 上下文压缩结构

### CompressionPolicy

作用：决定什么时候触发压缩、哪些消息要保护。

最小形状：

```python
policy = {
    "threshold": 0.5,
    "protect_last_n": 8,
}
```

相关章节：

- `h05`

### SummaryBlock

作用：用摘要替代一段较早的原始历史。

最小形状：

```python
summary_block = {
    "compressed_turn_ids": [1, 2, 3, 4],
    "summary_text": "Earlier turns established the file layout...",
}
```

它是“压缩不是删除历史”的核心体现。

相关章节：

- `h05`

### CompressionResult

作用：表示一次压缩之后新的上下文结果。

最小形状：

```python
compression_result = {
    "messages": [...],
    "summary": summary_block,
    "lineage_id": "session_b",
}
```

它往往会同时影响：

- 当前可见上下文
- session 谱系
- 后续检索路径

相关章节：

- `h05`
- `h06`

---

## 6. 会话持久化结构

### SessionRecord

作用：保存一次 session 的持久化记录。

最小形状：

```python
session_record = {
    "session_id": "sess_123",
    "platform": "cli",
    "messages": [...],
    "created_at": "2026-04-10T10:00:00Z",
}
```

这是从“运行时消息列表”进入“可恢复会话记录”的关键桥梁。

相关章节：

- `h06`

### SessionLineage

作用：表示多个 session 之间的父子关系。

最小形状：

```python
session_lineage = {
    "session_id": "sess_new",
    "parent_session_id": "sess_old",
}
```

它让压缩后的 session 仍然能追溯到原始历史。

相关章节：

- `h05`
- `h06`

### FTS Index Record

作用：支持按关键词检索历史会话。

最小形状：

```python
fts_record = {
    "session_id": "sess_123",
    "search_text": "tool registry write file prompt builder",
}
```

它不是用户直接看到的结构，但它是 session search 能工作的基础。

相关章节：

- `h06`

---

## 7. 记忆与技能结构

### MemoryEntry

作用：表示一条值得跨会话保留的信息。

最小形状：

```python
memory_entry = {
    "category": "user_preference",
    "content": "User prefers concise summaries.",
}
```

Hermes 的关键不在于“能写 memory”，而在于“要先判断什么值得写进去”。

相关章节：

- `h07`

### MemoryStore

作用：保存长期记忆正文，例如 `MEMORY.md` / `USER.md`。

最小形状：

```python
memory_store = {
    "memory_md": "...",
    "user_md": "...",
}
```

它和 session 的区别在于：

- session 偏历史记录
- memory 偏提炼后的长期知识

相关章节：

- `h07`

### SkillDescriptor

作用：描述一个 skill 的元信息和正文。

最小形状：

```python
skill = {
    "name": "code-review",
    "description": "Guide for reviewing patches",
    "content": "...markdown body...",
}
```

相关章节：

- `h08`

### SkillInjection

作用：表示 skill 如何被注入当前对话。

最小形状：

```python
skill_injection = {
    "role": "user",
    "content": "Apply the following skill...",
}
```

关键点：它是 user message，不是 system prompt section。

相关章节：

- `h08`

---

## 8. 审批与恢复结构

### DangerPattern

作用：描述一条高风险操作匹配规则。

最小形状：

```python
danger_pattern = {
    "pattern": r"rm\s+-rf",
    "reason": "destructive command",
}
```

相关章节：

- `h09`

### ApprovalDecision

作用：表示一次工具调用的审批结果。

最小形状：

```python
approval_decision = {
    "action": "allow" | "deny" | "ask",
    "reason": "matched allowlist",
}
```

这类结构的价值是把安全判断从工具内部抽离出来，形成统一决策层。

相关章节：

- `h09`

### FallbackChain

作用：表示 provider / model 的备用调用顺序。

最小形状：

```python
fallback_chain = {
    "primary": "provider_a/model_x",
    "fallbacks": ["provider_b/model_y", "provider_c/model_z"],
}
```

相关章节：

- `h10`
- `h16`

### ContinuationReason

作用：解释为什么失败后主循环还要继续。

最小形状：

```python
continuation_reason = {
    "reason": "fallback_provider_retry",
}
```

它让错误恢复链条更可解释，而不是只靠隐式分支继续执行。

相关章节：

- `h10`

---

## 9. 多平台与扩展结构

### CommandDef

作用：描述一个 slash command 的中心注册信息。

最小形状：

```python
command_def = {
    "name": "/skills",
    "description": "List available skills",
    "handler": list_skills,
}
```

它的意义是“一份定义，多端复用”。

相关章节：

- `h11`

### MessageEvent

作用：把不同平台的输入标准化成统一事件对象。

最小形状：

```python
message_event = {
    "platform": "telegram",
    "user_id": "u123",
    "text": "summarize yesterday's work",
}
```

它是 gateway 层和 agent 层之间的重要边界对象。

相关章节：

- `h12`

### CronJob

作用：描述一个定时任务配置。

最小形状：

```python
cron_job = {
    "id": "job_daily_summary",
    "schedule": "0 9 * * *",
    "prompt": "summarize overnight alerts",
    "skill_attachment": "ops-summary",
}
```

相关章节：

- `h13`

### HookEvent

作用：描述 hook 生命周期中的一次事件。

最小形状：

```python
hook_event = {
    "stage": "post_tool_call",
    "tool_name": "write_file",
    "payload": {...},
}
```

它适合做观察与副作用，不适合接管主控制流。

相关章节：

- `h14`

### DelegationRequest

作用：表示父 agent 对子 agent 发起的一次子任务委派。

最小形状：

```python
delegation_request = {
    "task": "analyze provider fallback behavior",
    "shared_budget": 6,
}
```

相关章节：

- `h15`

### ProviderConfig

作用：描述模型 provider 的调用配置。

最小形状：

```python
provider_config = {
    "provider": "openrouter",
    "model": "anthropic/claude-3-5-sonnet",
    "base_url": "https://openrouter.ai/api/v1",
    "api_mode": "openai-compatible",
}
```

相关章节：

- `h16`

### MCPToolDescriptor

作用：描述从 MCP server 动态发现到的工具。

最小形状：

```python
mcp_tool = {
    "server": "filesystem",
    "name": "read_text",
    "schema": {...},
}
```

关键点：它最终也会进入统一 registry。

相关章节：

- `h17`

### PluginContext

作用：提供插件注册工具、hook、命令等能力的官方接口。

最小形状：

```python
plugin_context = {
    "register_tool": ..., 
    "register_hook": ..., 
    "register_command": ...,
}
```

相关章节：

- `h18`

### TrajectoryRecord

作用：表示一次 agent 运行抽取出来的训练轨迹。

最小形状：

```python
trajectory = {
    "input": "...",
    "messages": [...],
    "output": "...",
    "label": "successful",
}
```

相关章节：

- `h19`

---

## 最后怎么用这份结构表

如果你后面读某一章时开始乱，先问自己三个问题：

1. 我现在看到的是内容状态，还是流程状态？
2. 它是运行时临时存在，还是需要持久化？
3. 它属于主线 loop、扩展控制面，还是外围平台层？

只要这三个问题能答出来，你对 Hermes 的理解通常就不会再散掉。
