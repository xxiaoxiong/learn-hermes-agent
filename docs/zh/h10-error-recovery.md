# h10 — Error Recovery：fallback_providers 链与失败分层处理

> **核心洞察**：大多数失败不是任务失败——retry 和 fallback 是不同层级的响应；失败后重入循环继续才是正确姿势。

---

## 问题：API 失败了怎么办？

agent 在生产环境中会遇到各种 API 错误：

| 错误码 | 含义 | 正确处理 |
|---|---|---|
| 429 Rate Limit | 当前模型 QPS 超限 | 等待 + 重试，或切换 provider |
| 5xx Server Error | 上游服务临时故障 | 指数退避重试 |
| 401 Unauthorized | API 密钥无效/过期 | 立即切换备用 provider，不重试 |
| 400 Bad Request | 请求格式错误 | 不重试，记录错误，继续任务 |
| 408/504 Timeout | 请求超时 | 重试（可能是网络波动） |

关键原则：**失败不等于任务失败**。大多数时候，换条路继续就好了。

---

## 三类响应策略

### 1. Retry（重试）

适用于：429、5xx、408/504

```python
import time

def retry_with_backoff(func, max_retries: int = 3, base_delay: float = 1.0):
    """指数退避重试"""
    for attempt in range(max_retries):
        try:
            return func()
        except RateLimitError:
            if attempt == max_retries - 1:
                raise
            delay = base_delay * (2 ** attempt)  # 1s, 2s, 4s
            time.sleep(delay)
        except ServerError:
            if attempt == max_retries - 1:
                raise
            time.sleep(base_delay * (attempt + 1))
```

### 2. Fallback Provider（切换备用）

适用于：429（主模型持续限速）、401（密钥失效）

```python
FALLBACK_PROVIDERS = [
    {"model": "gpt-4o", "base_url": "https://api.openai.com/v1"},
    {"model": "claude-3-5-sonnet", "base_url": "https://api.anthropic.com"},
    {"model": "gpt-4o-mini", "base_url": "https://api.openai.com/v1"},  # 低成本备用
]

def call_with_fallback(messages, tools, providers=FALLBACK_PROVIDERS):
    """按顺序尝试每个 provider，直到成功"""
    last_error = None
    for provider in providers:
        try:
            client = OpenAI(
                base_url=provider["base_url"],
                api_key=get_api_key(provider),
            )
            return client.chat.completions.create(
                model=provider["model"],
                messages=messages,
                tools=tools,
            )
        except (RateLimitError, AuthenticationError) as e:
            last_error = e
            continue  # 尝试下一个 provider
        except Exception as e:
            raise  # 其他错误不触发 fallback

    raise last_error
```

### 3. Continuation Reason（重入循环继续）

API 调用失败时，agent 不应该终止任务。错误信息应作为 `tool_result` 回流给模型，让模型决定如何处理：

```python
try:
    response = call_with_fallback(messages, tools)
except Exception as e:
    # 把错误信息包装成 tool_result，让模型看到并决策
    messages.append({
        "role": "tool",
        "tool_call_id": tool_call.id,
        "content": f"[API Error] {type(e).__name__}: {str(e)[:200]}\n请尝试其他方式完成任务。",
    })
    continuation_reason = "api_error"
    continue  # 重入循环，让模型重新决策
```

---

## Auxiliary 任务的独立 Fallback 链

Hermes 除了主任务（用户对话），还有 auxiliary 任务：

- **vision**：图像理解（需要支持多模态的模型）
- **compression**：上下文压缩时调用的摘要生成
- **session_search**：历史会话语义搜索

这些任务有独立的 fallback 链，失败不影响主任务：

```python
AUXILIARY_PROVIDERS = {
    "vision": [
        {"model": "gpt-4o", ...},         # 首选：支持视觉
        {"model": "claude-3-5-sonnet", ...},
    ],
    "compression": [
        {"model": "gpt-4o-mini", ...},    # 低成本即可
        {"model": "claude-3-haiku", ...},
    ],
}
```

---

## 完整错误处理流程

```
API 调用失败
    ↓
429 Rate Limit?
  └─ 是 → 等 1s 重试，最多 3 次
           还是失败? → 切换 fallback provider
  └─ 否 ↓
5xx Server Error?
  └─ 是 → 指数退避重试
  └─ 否 ↓
401 Unauthorized?
  └─ 是 → 立即切换 fallback provider（不重试）
  └─ 否 ↓
其他错误
  └─ 包装为 tool_result 错误消息，重入循环，让模型决策
```

---

## 代码解读：snippets/h10_error_recovery.py

本章的 Code 标签展示了 `run_agent.py` fallback 逻辑的精选片段，关注：

1. **错误分类**：如何判断是 429、5xx 还是 401
2. **Fallback 链遍历**：`call_with_fallback()` 的核心逻辑
3. **Continuation**：失败后如何重入 while 循环

---

## 常见误区

**误区 1**：遇到任何错误都应该终止任务  
→ 只有不可恢复的错误（如任务本身逻辑错误）才应该终止。网络错误、rate limit 都是可恢复的，换条路继续。

**误区 2**：retry 和 fallback 是同一件事  
→ retry 是对同一个 provider 重试（等待后再试）；fallback 是切换到不同的 provider。429 通常先 retry 再 fallback，401 直接 fallback（重试无意义）。

**误区 3**：fallback 模型应该和主模型一样强  
→ fallback 的目标是"任务不中断"，不一定要用同等能力的模型。对于压缩、摘要等辅助任务，用便宜的小模型做 fallback 完全合理。
