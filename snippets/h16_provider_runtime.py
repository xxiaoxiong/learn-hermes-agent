# ============================================================
# H16: Multi-Provider Runtime — Hermes Real Source Snippets
# Source: hermes_cli/runtime_provider.py
#
# 核心洞察：api_mode 是 runtime 的核心决策
# 相同的模型 API 有三种"方言"：
#   - chat_completions  → OpenAI /v1/chat/completions (99% 兼容)
#   - codex_responses   → OpenAI Responses API (GPT-5+ reasoning models)
#   - anthropic_messages → Anthropic /v1/messages (native Claude)
# resolve_turn_route() 将 config/env → 统一 runtime dict
# ============================================================


# ── hermes_cli/runtime_provider.py: 37-46 — api_mode auto-detection ─────────
def _detect_api_mode_for_url(base_url: str):
    """Auto-detect api_mode from the resolved base URL.

    Direct api.openai.com endpoints need the Responses API for GPT-5.x
    tool calls with reasoning (chat/completions returns 400).
    """
    normalized = (base_url or "").strip().lower().rstrip("/")
    if "api.openai.com" in normalized and "openrouter" not in normalized:
        return "codex_responses"
    return None


# ── hermes_cli/runtime_provider.py: 127-136 ─────────────────────────────────
# Three valid api_mode values — config can override, but most are auto-detected
_VALID_API_MODES = {"chat_completions", "codex_responses", "anthropic_messages"}

def _parse_api_mode(raw):
    """Validate an api_mode value from config. Returns None if invalid."""
    if isinstance(raw, str):
        normalized = raw.strip().lower()
        if normalized in _VALID_API_MODES:
            return normalized
    return None


# ── hermes_cli/runtime_provider.py: 140-204 — provider → runtime dict ───────
# KEY: every provider resolves to the same 4-key runtime dict:
#   {"provider": str, "api_mode": str, "base_url": str, "api_key": str}
# AIAgent consumes only this dict — all provider-specific logic is here.

def _resolve_pool_entry_runtime(entry, provider: str, model_cfg: dict = None):
    """Translate a CredentialPool entry into a runtime dict."""
    base_url = (getattr(entry, "runtime_base_url", None) or getattr(entry, "base_url", None) or "").rstrip("/")
    api_key = getattr(entry, "runtime_api_key", None) or getattr(entry, "access_token", "")

    # Provider-specific api_mode selection
    api_mode = "chat_completions"
    if provider == "openai-codex":
        api_mode = "codex_responses"
    elif provider == "anthropic":
        api_mode = "anthropic_messages"
    elif provider == "nous":
        api_mode = "chat_completions"
    elif provider == "copilot":
        api_mode = _copilot_runtime_api_mode(model_cfg or {}, api_key)
    else:
        # Honour explicit api_mode from config when provider context matches
        configured_mode = _parse_api_mode((model_cfg or {}).get("api_mode"))
        if configured_mode and _provider_supports_explicit_api_mode(provider):
            api_mode = configured_mode
        elif (base_url or "").rstrip("/").endswith("/anthropic"):
            api_mode = "anthropic_messages"

    return {
        "provider": provider,
        "api_mode": api_mode,
        "base_url": base_url,
        "api_key": api_key,
        "source": getattr(entry, "source", "pool"),
    }


# ── How AIAgent consumes the runtime dict (run_agent.py: ~840-870) ───────────
#
# The runtime dict flows into AIAgent.__init__() as keyword args:
#
#   runtime = resolve_turn_route()
#   agent = AIAgent(
#       model=model,
#       api_key=runtime["api_key"],
#       base_url=runtime["base_url"],
#       api_mode=runtime["api_mode"],
#       provider=runtime["provider"],
#   )
#
# Then inside AIAgent._make_api_call():
#   if self.api_mode == "codex_responses":
#       return self._run_codex_stream(kwargs)
#   elif self.api_mode == "anthropic_messages":
#       return self._anthropic_messages_create(kwargs)
#   else:
#       return self._openai_client.chat.completions.create(**kwargs)
#
# KEY: the agent loop itself does NOT know which provider it's talking to.
# api_mode is the only branch point; all three paths produce the same
# normalized response format consumed by the loop.


# ── Key provider routing table ────────────────────────────────────────────────
# Provider      api_mode              Base URL
# ──────────    ──────────────────    ────────────────────────────────────────
# openai        codex_responses       https://api.openai.com
# anthropic     anthropic_messages    https://api.anthropic.com
# nous          chat_completions      https://inference.noussearch.ai/v1
# openrouter    chat_completions      https://openrouter.ai/api/v1
# copilot       chat_completions      https://api.githubcopilot.com
# custom        chat_completions      <user-defined base_url>
# ollama        chat_completions      http://localhost:11434/v1
