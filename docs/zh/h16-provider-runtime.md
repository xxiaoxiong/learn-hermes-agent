# h16 — Provider Runtime：(provider, model) → api_mode 映射

> **核心洞察**：provider 抽象层不是 if-else——它是 `(provider, model) → (api_mode, key, url)` 的映射，支持 18+ provider。

---

## 问题：如何做到"换模型无需改代码"？

硬编码方式：

```python
# ❌ 每个模型一套 if-else
if model.startswith("gpt"):
    client = OpenAI(api_key=OPENAI_KEY)
elif model.startswith("claude"):
    client = Anthropic(api_key=ANTHROPIC_KEY)
elif model.startswith("gemini"):
    client = ...
```

每次加新模型都改代码。更糟糕的是，多个地方都有类似的 if-else，修改一处可能漏掉另一处。

---

## 三种 API Mode

Hermes 把所有 provider 统一为三种 API mode：

| API Mode | 对应 SDK | 典型 Provider |
|---|---|---|
| `chat_completions` | OpenAI SDK | OpenAI、OpenRouter、本地 Ollama、大多数兼容接口 |
| `anthropic_messages` | Anthropic SDK | Anthropic 原生 |
| `codex_responses` | OpenAI Responses API | OpenAI o-series models |

无论用哪个 provider，最终都走这三条 API 路径之一。

---

## Provider Resolution：四级优先链

```python
def resolve_api_mode(
    provider: str | None,
    model: str,
    base_url: str | None,
    explicit_mode: str | None,
) -> str:
    """
    解析 API mode，优先级：
    explicit > provider > base_url > default
    """
    # [1] 显式指定（最高优先级）
    if explicit_mode:
        return explicit_mode

    # [2] 已知 provider 的预设 mode
    PROVIDER_MODES = {
        "anthropic": "anthropic_messages",
        "openai":    "chat_completions",
        "openrouter":"chat_completions",
        "ollama":    "chat_completions",
        "groq":      "chat_completions",
    }
    if provider and provider in PROVIDER_MODES:
        return PROVIDER_MODES[provider]

    # [3] 根据 base_url 推断
    if base_url:
        if "anthropic.com" in base_url:
            return "anthropic_messages"
        if "openai.com" in base_url or "openrouter" in base_url:
            return "chat_completions"

    # [4] 默认
    return "chat_completions"
```

---

## Credential Resolution

```python
def resolve_credentials(
    provider: str | None,
    model: str,
    env: dict,
) -> tuple[str, str]:
    """
    返回 (api_key, base_url)。
    优先读 provider 专属环境变量，fallback 到通用变量。
    """
    # provider 专属密钥
    PROVIDER_KEY_VARS = {
        "openai":    "OPENAI_API_KEY",
        "anthropic": "ANTHROPIC_API_KEY",
        "openrouter":"OPENROUTER_API_KEY",
        "groq":      "GROQ_API_KEY",
    }
    PROVIDER_URL_VARS = {
        "openai":    "https://api.openai.com/v1",
        "anthropic": "https://api.anthropic.com",
        "openrouter":"https://openrouter.ai/api/v1",
        "groq":      "https://api.groq.com/openai/v1",
        "ollama":    "http://localhost:11434/v1",
    }

    if provider:
        key_var = PROVIDER_KEY_VARS.get(provider, "HERMES_API_KEY")
        api_key = env.get(key_var) or env.get("HERMES_API_KEY", "")
        base_url = env.get(f"{provider.upper()}_BASE_URL") or PROVIDER_URL_VARS.get(provider, "")
        return api_key, base_url

    # fallback 到通用 .env 配置
    return env.get("HERMES_API_KEY", ""), env.get("HERMES_BASE_URL", "")
```

---

## CredentialPool：多账号负载均衡

```python
import itertools

class CredentialPool:
    """
    维护同一 provider 的多个 API key，
    轮询使用，实现负载均衡和速率分散。
    """
    def __init__(self, keys: list[str]):
        self._keys = keys
        self._cycle = itertools.cycle(keys)
        self._lock = threading.Lock()

    def next_key(self) -> str:
        with self._lock:
            return next(self._cycle)

# 配置示例（.env）
# OPENAI_API_KEYS=key1,key2,key3
pool = CredentialPool(os.getenv("OPENAI_API_KEYS", "").split(","))
```

---

## 完整 Provider Runtime 流程

```
用户配置 .env:
  HERMES_MODEL=openai/gpt-4o
  HERMES_API_KEY=sk-...

运行时解析：
  model = "openai/gpt-4o"
  provider, model_name = model.split("/", 1)  → ("openai", "gpt-4o")
  api_mode = resolve_api_mode(provider, model_name, ...)  → "chat_completions"
  api_key, base_url = resolve_credentials(provider, ...)  → (sk-..., https://api.openai.com/v1)

创建 client：
  client = OpenAI(api_key=api_key, base_url=base_url)
  response = client.chat.completions.create(model=model_name, ...)
```

---

## 代码解读：snippets/h16_provider_runtime.py

本章 Code 标签展示 `hermes_cli/runtime_provider.py` 和 `hermes_cli/auth.py` 的精选片段，关注：

1. **`resolve_api_mode()`** — 四级优先链的实现
2. **`resolve_credentials()`** — provider → key + url 的映射
3. **`CredentialPool`** — 多 key 轮询的线程安全实现

---

## 常见误区

**误区 1**：每个 provider 需要一个单独的 client 类  
→ 大多数 provider 都兼容 OpenAI API 格式（`chat_completions`），只需修改 `base_url` 和 `api_key`。一个 `OpenAI` SDK 实例就能接入大多数 provider。

**误区 2**：api_mode 解析只在初始化时做一次  
→ Hermes 在每次 API 调用前都解析，以支持动态切换（如 fallback 到不同 provider 时 api_mode 可能不同）。

**误区 3**：CredentialPool 会导致 API 请求跨账号混乱  
→ 每次 `next_key()` 返回一个完整的 API key，同一请求只用一个 key。轮询只影响不同请求使用哪个 key，不影响单次请求的完整性。
