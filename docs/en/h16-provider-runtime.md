# h16 — Provider Runtime: (provider, model) → api_mode Mapping

> **Core Insight**: The provider abstraction layer is not an if-else chain — it is a `(provider, model) → (api_mode, key, url)` mapping that supports 18+ providers.

---

## The Problem: How to Switch Models Without Changing Code?

The hard-coded approach:

```python
# ❌ A separate if-else for each model
if model.startswith("gpt"):
    client = OpenAI(api_key=OPENAI_KEY)
elif model.startswith("claude"):
    client = Anthropic(api_key=ANTHROPIC_KEY)
elif model.startswith("gemini"):
    client = ...
```

Every new model requires code changes. Worse, similar if-else blocks exist in multiple places — fixing one may miss another.

---

## Three API Modes

Hermes unifies all providers into three API modes:

| API Mode | Corresponding SDK | Typical Providers |
|---|---|---|
| `chat_completions` | OpenAI SDK | OpenAI, OpenRouter, local Ollama, most compatible endpoints |
| `anthropic_messages` | Anthropic SDK | Anthropic native |
| `codex_responses` | OpenAI Responses API | OpenAI o-series models |

Regardless of the provider, the request ultimately goes through one of these three API paths.

---

## Provider Resolution: Four-Level Priority Chain

```python
def resolve_api_mode(
    provider: str | None,
    model: str,
    base_url: str | None,
    explicit_mode: str | None,
) -> str:
    """
    Resolve API mode with priority:
    explicit > provider > base_url > default
    """
    # [1] Explicit specification (highest priority)
    if explicit_mode:
        return explicit_mode

    # [2] Known provider's preset mode
    PROVIDER_MODES = {
        "anthropic": "anthropic_messages",
        "openai":    "chat_completions",
        "openrouter":"chat_completions",
        "ollama":    "chat_completions",
        "groq":      "chat_completions",
    }
    if provider and provider in PROVIDER_MODES:
        return PROVIDER_MODES[provider]

    # [3] Infer from base_url
    if base_url:
        if "anthropic.com" in base_url:
            return "anthropic_messages"
        if "openai.com" in base_url or "openrouter" in base_url:
            return "chat_completions"

    # [4] Default
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
    Returns (api_key, base_url).
    Prefers provider-specific env vars, falls back to generic vars.
    """
    # Provider-specific keys
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

    # Fallback to generic .env configuration
    return env.get("HERMES_API_KEY", ""), env.get("HERMES_BASE_URL", "")
```

---

## CredentialPool: Multi-Account Load Balancing

```python
import itertools

class CredentialPool:
    """
    Maintains multiple API keys for the same provider.
    Round-robin usage for load balancing and rate distribution.
    """
    def __init__(self, keys: list[str]):
        self._keys = keys
        self._cycle = itertools.cycle(keys)
        self._lock = threading.Lock()

    def next_key(self) -> str:
        with self._lock:
            return next(self._cycle)

# Configuration example (.env)
# OPENAI_API_KEYS=key1,key2,key3
pool = CredentialPool(os.getenv("OPENAI_API_KEYS", "").split(","))
```

---

## Complete Provider Runtime Flow

```
User configures .env:
  HERMES_MODEL=openai/gpt-4o
  HERMES_API_KEY=sk-...

Runtime resolution:
  model = "openai/gpt-4o"
  provider, model_name = model.split("/", 1)  → ("openai", "gpt-4o")
  api_mode = resolve_api_mode(provider, model_name, ...)  → "chat_completions"
  api_key, base_url = resolve_credentials(provider, ...)  → (sk-..., https://api.openai.com/v1)

Create client:
  client = OpenAI(api_key=api_key, base_url=base_url)
  response = client.chat.completions.create(model=model_name, ...)
```

---

## Code Walkthrough: snippets/h16_provider_runtime.py

The Code tab for this chapter shows curated snippets from `hermes_cli/runtime_provider.py` and `hermes_cli/auth.py`, focusing on:

1. **`resolve_api_mode()`** — The four-level priority chain implementation
2. **`resolve_credentials()`** — The provider → key + url mapping
3. **`CredentialPool`** — Thread-safe multi-key round-robin

---

## Common Misconceptions

**Misconception 1**: Each provider needs a separate client class  
→ Most providers are compatible with the OpenAI API format (`chat_completions`); you only need to change `base_url` and `api_key`. A single `OpenAI` SDK instance can connect to most providers.

**Misconception 2**: api_mode resolution is done only once at initialization  
→ Hermes resolves before every API call to support dynamic switching (e.g., when falling back to a different provider, the api_mode may differ).

**Misconception 3**: CredentialPool causes cross-account confusion in API requests  
→ Each `next_key()` returns one complete API key; a single request uses only one key. Round-robin only affects which key is used for different requests, not the integrity of any single request.
