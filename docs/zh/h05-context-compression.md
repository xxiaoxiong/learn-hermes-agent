# h05 — Context Compression：preflight 触发 + middle turns 摘要 + lineage 谱系

> **核心洞察**：压缩不是删除历史——"中间摘要 + 保留最新 N 条"才是正确姿势；`lineage_id` 保证谱系可追溯。

---

## 问题：上下文越跑越长怎么办？

每次工具调用，messages 列表就增长几条。长时间运行后：

- **超过模型上下文窗口**：API 报错 `context length exceeded`
- **token 消耗爆增**：每轮 API 调用都发送完整历史，成本随 messages 长度线性增长
- **模型注意力分散**：太长的历史会稀释关键信息的影响力

---

## 错误做法：直接截断

```python
# ❌ 只保留最后 N 条——丢失中间过程
messages = messages[-20:]
```

问题：
1. 可能切断 `tool_call` 和对应的 `tool_result` 配对，导致 API 报错
2. 中间发生了什么完全丢失，模型无法参考

---

## 正确做法：middle turns 摘要

```
原始 messages（40 条）：
  [user][assistant][tool][tool_result]    ← turn 1
  [assistant][tool][tool_result]          ← turn 2 (tool_call + result pair，不能拆分)
  ...
  [assistant][tool][tool_result]          ← turn 38

压缩后 messages（12 条）：
  [user: "任务摘要：在 turn 1-35 中，agent..."]  ← 摘要块（新增）
  [assistant][tool][tool_result]          ← turn 36（保留）
  [assistant][tool][tool_result]          ← turn 37（保留）
  [assistant content]                     ← turn 38（保留，protect_last_n=5）
```

关键规则：
1. **不拆分 tool_call/result 配对**：`[assistant tool_call]` 和对应的 `[tool: tool_call_id]` 必须成对保留或成对压缩
2. **保留最新 N 条**：`protect_last_n` 条消息不压缩，保留最近的工作上下文
3. **中间部分摘要**：调用同一个 LLM 生成摘要文本

---

## 关键数据结构

### CompressionPolicy

```python
@dataclass
class CompressionPolicy:
    threshold_pct: float = 0.50  # token 使用率超过 50% 触发压缩
    protect_last_n: int = 5      # 最新 N 条消息不压缩
    max_context_tokens: int = 100_000  # 模型上下文窗口大小
```

### SummaryBlock

压缩后插入 messages 的摘要消息：

```python
{
    "role": "user",
    "content": f"[上下文摘要] 以下是之前对话的摘要：\n\n{summary_text}",
    "_is_summary": True,  # 标记为摘要块，方便后续识别
}
```

### lineage_id

```python
import uuid

class ContextCompressor:
    def compress(self, messages, session_id):
        # ...执行压缩...
        new_lineage_id = str(uuid.uuid4())
        # 新 session 记录 parent_session_id = session_id
        return compressed_messages, {
            "lineage_id": new_lineage_id,
            "parent_session_id": session_id,
        }
```

---

## preflight 检查机制

每次 API 调用前，先估算当前 token 使用率：

```python
def needs_compression(self, messages: list[dict]) -> bool:
    """简化估算：字符数 / 4 ≈ token 数（英文约 4 字符/token）"""
    estimated_tokens = sum(
        len(str(m.get("content", ""))) // 4
        for m in messages
    )
    usage_pct = estimated_tokens / self.policy.max_context_tokens
    return usage_pct >= self.policy.threshold_pct
```

Hermes 的两种触发时机：
- **preflight（50%）**：每次 API 调用前检查，主动触发
- **gateway auto（85%）**：Gateway 层在 context 接近满载时强制触发

---

## tool_call / result pair 不拆分

这是最重要的实现细节：

```python
def _collect_pairs(self, messages):
    """把 messages 解析为 turn pairs，确保 tool_call 和 result 成对处理"""
    pairs = []
    i = 0
    while i < len(messages):
        msg = messages[i]
        if msg.get("role") == "assistant" and msg.get("tool_calls"):
            # 收集紧跟的所有 tool results
            results = []
            j = i + 1
            while j < len(messages) and messages[j].get("role") == "tool":
                results.append(messages[j])
                j += 1
            pairs.append({"call": msg, "results": results})
            i = j
        else:
            pairs.append({"call": msg, "results": []})
            i += 1
    return pairs
```

压缩时，保留最后 `protect_last_n` 个完整 pair，对前面的 pairs 生成摘要。

---

## lineage_id 的意义

压缩产生一个**新 session**，不是覆盖原 session：

```
session-001 (原始，40条 messages)
    ↓ 压缩
session-002 (压缩后，12条 messages，parent_session_id = "session-001")
    ↓ 再次压缩
session-003 (parent_session_id = "session-002")
```

这样：
- 原始完整历史永远存在（SQLite 里）
- FTS5 全文搜索可以在所有谱系节点上检索
- 可以通过 `parent_session_id` 链路追溯任意历史版本

---

## 与 Hermes 真实代码的对应

| 教学实现 | Hermes 源码 | 说明 |
|---|---|---|
| `CompressionPolicy` | `CompressionPolicy` | 字段和语义完全一致 |
| `ContextCompressor.compress()` | `ContextCompressor.compress()` | 相同逻辑，Hermes 版更健壮 |
| `protect_last_n` | `protect_last_n` | 相同参数 |
| `lineage_id` | `lineage_id` | Hermes 中是会话的核心追踪字段 |
| preflight 50% | preflight 50% + gateway 85% | Hermes 有两套触发机制 |

---

## 常见误区

**误区 1**：压缩 = 删掉最老的消息  
→ 删掉消息会破坏 tool_call/result 配对，导致 API 报错。正确做法是用摘要替换中间 turns。

**误区 2**：保留更多 messages 效果更好  
→ 超过上下文窗口会报错；接近上下文窗口时 API 成本急剧上升；模型注意力也会分散。合理的 `protect_last_n`（如 5-10 条）通常已足够。

**误区 3**：lineage_id 只是一个随机 ID  
→ 它是 session 谱系链的核心。配合 SQLite 的 `parent_session_id` 字段，实现"压缩后仍可追溯历史"的关键能力。

---

## 动手练习

1. 运行 `python agents/h05_context_compression.py`，观察压缩前后的 messages 数量变化
2. 修改 `protect_last_n = 2`，观察哪些 messages 被保留
3. 打印 `lineage_id`，理解它如何连接压缩前后的两个 session
