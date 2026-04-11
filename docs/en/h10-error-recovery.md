# h10 — Error Recovery: Fallback Provider Chains and Layered Failure Handling

> **Core Insight**: Most failures are not task failures — retry and fallback are different response layers; re-entering the loop to continue is the correct approach.

---

## The Problem: What Happens When an API Call Fails?

An agent in production encounters various API errors:

| Error Code | Meaning | Correct Response |
|---|---|---|
| 429 Rate Limit | Current model QPS exceeded | Wait + retry, or switch provider |
| 5xx Server Error | Upstream service temporarily down | Exponential backoff retry |
| 401 Unauthorized | API key invalid/expired | Immediately switch to fallback provider, do not retry |
| 400 Bad Request | Malformed request | Do not retry, log error, continue task |
| 408/504 Timeout | Request timed out | Retry (likely a network glitch) |

Key principle: **Failure ≠ task failure**. Most of the time, just take a different path and continue.

---

## Three Response Strategies

### 1. Retry

Applicable to: 429, 5xx, 408/504

```python
import time

def retry_with_backoff(func, max_retries: int = 3, base_delay: float = 1.0):
    """Exponential backoff retry"""
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

### 2. Fallback Provider

Applicable to: 429 (persistent rate limiting on primary), 401 (key expired)

```python
FALLBACK_PROVIDERS = [
    {"model": "gpt-4o", "base_url": "https://api.openai.com/v1"},
    {"model": "claude-3-5-sonnet", "base_url": "https://api.anthropic.com"},
    {"model": "gpt-4o-mini", "base_url": "https://api.openai.com/v1"},  # Low-cost backup
]

def call_with_fallback(messages, tools, providers=FALLBACK_PROVIDERS):
    """Try each provider in order until one succeeds"""
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
            continue  # Try the next provider
        except Exception as e:
            raise  # Other errors do not trigger fallback

    raise last_error
```

### 3. Continuation Reason (Re-Enter the Loop)

When an API call fails, the agent should not terminate the task. The error should flow back to the model as a `tool_result`, letting the model decide how to proceed:

```python
try:
    response = call_with_fallback(messages, tools)
except Exception as e:
    # Wrap the error as a tool_result so the model can see it and decide
    messages.append({
        "role": "tool",
        "tool_call_id": tool_call.id,
        "content": f"[API Error] {type(e).__name__}: {str(e)[:200]}\nPlease try an alternative approach.",
    })
    continuation_reason = "api_error"
    continue  # Re-enter the loop and let the model re-decide
```

---

## Independent Fallback Chains for Auxiliary Tasks

Besides the main task (user conversation), Hermes has auxiliary tasks:

- **vision**: Image understanding (requires a multimodal-capable model)
- **compression**: Summary generation during context compression
- **session_search**: Semantic search across historical sessions

These tasks have independent fallback chains; their failures do not affect the main task:

```python
AUXILIARY_PROVIDERS = {
    "vision": [
        {"model": "gpt-4o", ...},         # Primary: supports vision
        {"model": "claude-3-5-sonnet", ...},
    ],
    "compression": [
        {"model": "gpt-4o-mini", ...},    # Low cost is sufficient
        {"model": "claude-3-haiku", ...},
    ],
}
```

---

## Complete Error Handling Flow

```
API call fails
    ↓
429 Rate Limit?
  └─ Yes → Wait 1s and retry, up to 3 times
           Still failing? → Switch to fallback provider
  └─ No  ↓
5xx Server Error?
  └─ Yes → Exponential backoff retry
  └─ No  ↓
401 Unauthorized?
  └─ Yes → Immediately switch to fallback provider (do not retry)
  └─ No  ↓
Other errors
  └─ Wrap as tool_result error message, re-enter loop, let the model decide
```

---

## Code Walkthrough: snippets/h10_error_recovery.py

The Code tab for this chapter shows curated snippets from `run_agent.py`'s fallback logic, focusing on:

1. **Error classification**: How to distinguish 429, 5xx, and 401
2. **Fallback chain traversal**: The core logic of `call_with_fallback()`
3. **Continuation**: How to re-enter the while loop after a failure

---

## Common Misconceptions

**Misconception 1**: Any error should terminate the task  
→ Only unrecoverable errors (like fundamental logic errors in the task itself) should terminate. Network errors and rate limits are recoverable — take a different path and continue.

**Misconception 2**: Retry and fallback are the same thing  
→ Retry means trying the same provider again (wait and retry); fallback means switching to a different provider. For 429, typically retry first then fallback; for 401, fallback immediately (retrying is pointless).

**Misconception 3**: The fallback model should be as powerful as the primary  
→ The goal of fallback is "don't interrupt the task," not necessarily using an equally capable model. For compression, summarization, and other auxiliary tasks, using a cheap small model as fallback is perfectly reasonable.
