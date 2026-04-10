# h15 — Subagent Delegation：IterationBudget 共享与上下文隔离

> **核心洞察**：子 agent 的关键是干净的上下文，不是独立的 API 调用——context isolation 才是 delegation 的核心。

---

## 问题：什么时候需要子 agent？

当一个复杂任务可以分解为**并发执行**的子任务，或者子任务需要**隔离的工作上下文**时。

例如：
- 同时分析 3 个代码库，每个独立处理
- 把"写文档"委托给子 agent，主 agent 继续做其他事
- 子任务需要独立的 tool_calls 历史（避免主 agent 的上下文被污染）

子 agent 的关键价值：**干净的上下文**。不是"并行 API 调用"（那用 async 就够了），而是"子任务有自己的 messages 空间"。

---

## delegate_tool：子 agent spawn 接口

```python
DELEGATE_SCHEMA = {
    "name": "delegate",
    "description": "将子任务委派给子 agent 独立执行",
    "parameters": {
        "type": "object",
        "properties": {
            "task": {
                "type": "string",
                "description": "子 agent 要完成的任务描述",
            },
            "context": {
                "type": "string",
                "description": "提供给子 agent 的初始上下文（可选）",
            },
        },
        "required": ["task"],
    },
}
```

---

## IterationBudget：跨父子 agent 共享

```python
import threading
from dataclasses import dataclass

@dataclass
class IterationBudget:
    """
    父子 agent 共享的迭代预算。
    子 agent 消耗的迭代计入父 agent 的预算。
    保证整个任务树的总迭代数不超过上限。
    """
    _lock: threading.Lock
    _remaining: int
    _total: int

    @classmethod
    def create(cls, total: int = 100) -> "IterationBudget":
        return cls(_lock=threading.Lock(), _remaining=total, _total=total)

    def consume(self, n: int = 1) -> bool:
        """消耗 n 次迭代，返回是否还有剩余预算"""
        with self._lock:
            if self._remaining <= 0:
                return False
            self._remaining -= n
            return True

    @property
    def remaining(self) -> int:
        with self._lock:
            return self._remaining
```

父 agent 把 `budget` 对象传给子 agent：

```python
class AIAgent:
    def __init__(self, budget: IterationBudget | None = None):
        self.budget = budget or IterationBudget.create(total=50)

    def _spawn_subagent(self, task: str, context: str = "") -> str:
        """创建子 agent，共享父 agent 的 budget"""
        sub_agent = AIAgent(budget=self.budget)  # ← 共享同一个 budget 对象
        sub_agent.messages = []  # ← 干净的 messages（隔离）
        if context:
            sub_agent.messages.append({"role": "user", "content": context})
        return sub_agent.run_conversation(task)
```

---

## ThreadPoolExecutor：并发执行多个子 agent

```python
from concurrent.futures import ThreadPoolExecutor, as_completed

def _handle_delegate(self, tool_calls: list[dict]) -> list[str]:
    """
    并发执行多个 delegate 调用，结果按原始顺序回填。
    """
    futures = {}
    results = [""] * len(tool_calls)

    with ThreadPoolExecutor(max_workers=4) as executor:
        for i, tc in enumerate(tool_calls):
            args = json.loads(tc["function"]["arguments"])
            future = executor.submit(
                self._spawn_subagent,
                task=args["task"],
                context=args.get("context", ""),
            )
            futures[future] = i

        for future in as_completed(futures):
            idx = futures[future]
            try:
                results[idx] = future.result()
            except Exception as e:
                results[idx] = f"[子 Agent 执行失败: {e}]"

    return results
```

**结果按原始顺序回填**：并发执行，但 messages 里的 tool_result 顺序与 tool_call 顺序一致。

---

## 上下文隔离的实现

```
父 agent messages:
  [user: "分析这三个代码库：A、B、C"]
  [assistant: tool_calls=[delegate(A), delegate(B), delegate(C)]]
  [tool: 子agent分析A的完整报告]   ← 摘要，不是子agent的全部messages
  [tool: 子agent分析B的完整报告]
  [tool: 子agent分析C的完整报告]

子 agent A 的 messages（独立）:
  [user: "分析代码库 A"]
  [assistant: tool_call=read_file("A/main.py")]
  [tool: <A/main.py 内容>]
  [assistant: 分析结果]
```

子 agent 的 messages 不污染父 agent 的上下文。父 agent 只看到子 agent 的最终输出（摘要）。

---

## 代码解读：snippets/h15_subagent.py

本章 Code 标签展示 `tools/delegate_tool.py` 的精选片段，关注：

1. **`IterationBudget.consume()`** — 线程安全的预算消耗
2. **`_spawn_subagent()`** — fresh messages + shared budget
3. **`ThreadPoolExecutor` 并发** — future → 顺序回填

---

## 常见误区

**误区 1**：子 agent 应该有自己独立的 IterationBudget  
→ 预算必须共享，否则一个任务可以通过 N 层子 agent 无限放大迭代次数。共享预算是防止资源滥用的关键。

**误区 2**：子 agent 的主要价值是并行 API 调用  
→ 并行只是附带价值。核心价值是上下文隔离：子任务有干净的 messages 空间，不受父 agent 历史的干扰，结果更准确。

**误区 3**：子 agent 执行失败应该中止整个任务  
→ 子 agent 的异常被包装为 `[子 Agent 执行失败: ...]` 的 tool_result，父 agent 可以据此决策（重试、跳过、报告）。
