# h14 — Hook System：不改主循环扩展 agent 行为

> **核心洞察**：hook 只能观察和注解，不能替代主循环的控制流——这是插件可扩展性的设计边界。

---

## 问题：如何在不修改主循环的前提下增加新行为？

需求场景：
- 每次工具调用后打印日志
- 统计每轮 API 调用的 token 消耗
- 特定工具执行后触发通知
- 插件在 message 接收时做预处理

如果每个需求都改 `run_agent.py`，主循环会变得越来越臃肿，不同用途的逻辑混在一起。

---

## 解决方案：HookEvent 生命周期

```python
from enum import Enum

class HookEvent(str, Enum):
    PRE_TOOL_CALL   = "pre_tool_call"    # 工具调用前
    POST_TOOL_CALL  = "post_tool_call"   # 工具调用后（有结果）
    ON_MESSAGE      = "on_message"       # 收到用户消息时
    ON_RESPONSE     = "on_response"      # 模型给出最终回复时
    ON_ERROR        = "on_error"         # 发生错误时
    PRE_COMPRESS    = "pre_compress"     # 上下文压缩前
    POST_COMPRESS   = "post_compress"    # 上下文压缩后
```

每个事件点，所有注册的 handler 按顺序执行：

```
主循环执行 tool_call
    ↓ 触发 PRE_TOOL_CALL 钩子
        → builtin_hook_1(event_data)  # 内置：记录 tool_call 开始时间
        → plugin_hook_A(event_data)   # 插件 A 注册的 hook
    ↓ 实际执行工具
    ↓ 触发 POST_TOOL_CALL 钩子
        → builtin_hook_2(event_data)  # 内置：记录耗时
        → plugin_hook_A(event_data)   # 插件 A 的 post 处理
```

---

## HookManager：注册与触发

```python
from typing import Callable, Any

HookHandler = Callable[[dict], None]  # 接收 event_data，无返回值

class HookManager:
    def __init__(self):
        self._hooks: dict[HookEvent, list[HookHandler]] = {
            event: [] for event in HookEvent
        }

    def register(self, event: HookEvent, handler: HookHandler) -> None:
        """注册一个 hook handler"""
        self._hooks[event].append(handler)

    def fire(self, event: HookEvent, **event_data) -> None:
        """
        触发所有注册了该事件的 handler。
        hook handler 的异常不能传播到主循环！
        """
        for handler in self._hooks[event]:
            try:
                handler(event_data)
            except Exception as e:
                print(f"[Hook Error] {event.value}: {e}")  # 静默处理
```

**关键**：`fire()` 用 `try-except` 包住每个 handler，hook 的异常不会中断主循环。

---

## Builtin Hooks：始终注册的内置钩子

```python
def register_builtin_hooks(manager: HookManager) -> None:
    """内置钩子，不依赖任何插件，始终生效"""

    # 工具调用耗时统计
    call_times: dict[str, float] = {}

    def on_pre_tool_call(data: dict) -> None:
        call_times[data["tool_call_id"]] = time.time()

    def on_post_tool_call(data: dict) -> None:
        start = call_times.pop(data["tool_call_id"], None)
        if start:
            elapsed = time.time() - start
            data["elapsed_ms"] = int(elapsed * 1000)

    manager.register(HookEvent.PRE_TOOL_CALL, on_pre_tool_call)
    manager.register(HookEvent.POST_TOOL_CALL, on_post_tool_call)
```

---

## 在主循环中触发 Hook

```python
# run_agent.py（加入 hook 触发后）

for tool_call in message.tool_calls:
    name = tool_call.function.name
    args = json.loads(tool_call.function.arguments)

    # 触发 PRE_TOOL_CALL
    self.hooks.fire(
        HookEvent.PRE_TOOL_CALL,
        tool_name=name,
        tool_call_id=tool_call.id,
        args=args,
    )

    # 实际执行工具
    result = self.registry.dispatch(name, args)

    # 触发 POST_TOOL_CALL
    self.hooks.fire(
        HookEvent.POST_TOOL_CALL,
        tool_name=name,
        tool_call_id=tool_call.id,
        result=str(result),
    )
```

---

## Hook 的边界：观察但不控制

hook handler 接收 `event_data` 只读（或追加字段），**不能**：
- 中断主循环（没有返回值机制）
- 修改 tool_call 的执行参数
- 替代工具的执行逻辑

这是设计上有意为之的限制。如果需要控制流（如拦截危险操作），应该走 `ApprovalGate`（h09），不是 hook。

---

## 插件通过 PluginContext 注册 Hook

```python
# 插件代码（h18 会详细讲）
class MyPlugin:
    def setup(self, ctx: PluginContext) -> None:
        ctx.register_hook(HookEvent.POST_TOOL_CALL, self.on_tool_done)

    def on_tool_done(self, data: dict) -> None:
        print(f"✅ {data['tool_name']} 完成，耗时 {data.get('elapsed_ms', '?')}ms")
```

---

## 代码解读：snippets/h14_hooks_system.py

本章 Code 标签展示 `gateway/hooks.py` 的精选片段，关注：

1. **`HookEvent` 枚举** — 完整的生命周期事件列表
2. **`HookManager.fire()`** — 静默异常处理确保主循环安全
3. **`register_builtin_hooks()`** — 内置耗时统计的实现

---

## 常见误区

**误区 1**：hook 可以修改工具的执行结果  
→ 不可以。`POST_TOOL_CALL` 的 `event_data` 是只读快照，修改它不影响 messages 里已追加的 tool_result。

**误区 2**：hook 抛出异常会中断 agent  
→ 不会。`fire()` 捕获所有 hook 异常并记录，主循环继续运行。这是为了保证 agent 稳定性。

**误区 3**：hook 和 approval（h09）都可以拦截工具  
→ approval 在工具执行**之前**做 yes/no 决策；hook 在工具执行**前后**做观察和注解。两者职责不同，不能互换。
