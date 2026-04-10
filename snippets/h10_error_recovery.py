# ============================================================
# H10: Error Recovery — Hermes Real Source Snippets
# Source: run_agent.py
#
# 核心洞察：大多数失败不是任务失败
# retry 和 fallback 是不同层级的响应：
#   - retry: 同一 provider 重试（429 Rate Limit, 529 overload）
#   - fallback: 切换到备用 provider chain（429 已用完重试次数，5xx, 401）
#   - continuation: 失败后不退出，重入循环继续执行
# ============================================================


# ── run_agent.py: 882-905 — fallback_providers chain init ───────────────────
# Supports both legacy single-dict ``fallback_model`` and new list format.
# Config:
#   fallback_providers:
#     - provider: openrouter
#       model: meta-llama/llama-3-70b-instruct
#     - provider: anthropic
#       model: claude-3-haiku-20240307

class AIAgent:
    def __init__(self, model=None, fallback_model=None, **kwargs):  # simplified signature
        # Provider fallback chain — ordered list of backup providers tried
        # when the primary is exhausted (rate-limit, overload, connection failure).
        if isinstance(fallback_model, list):
            self._fallback_chain = [
                f for f in fallback_model
                if isinstance(f, dict) and f.get("provider") and f.get("model")
            ]
        elif isinstance(fallback_model, dict) and fallback_model.get("provider") and fallback_model.get("model"):
            self._fallback_chain = [fallback_model]
        else:
            self._fallback_chain = []
        self._fallback_index = 0
        self._fallback_activated = False


# ── run_agent.py: ~4200-4350 — _handle_api_error() error classification ─────
# Error triage: which errors are retryable vs which trigger fallback vs fatal

def _handle_api_error(self, error, attempt: int, max_attempts: int) -> str:
    """Classify and handle an API error.

    Returns a continuation reason string for the agent loop, or raises.

    Error classes:
      - RateLimitError (429): retry with backoff; after max_attempts, try fallback
      - APIStatusError 529: overload; retry with backoff
      - APIStatusError 5xx: server error; retry; if fallback available, switch
      - AuthenticationError (401): skip retries, try fallback immediately
      - ConnectionError: network glitch; retry
      - Timeout: retry with longer timeout

    KEY: the agent loop CONTINUES after error handling — failure ≠ task failure
    """
    error_type = type(error).__name__
    status_code = getattr(error, "status_code", None)

    is_rate_limit = status_code == 429
    is_overload = status_code == 529
    is_server_error = status_code and 500 <= status_code < 600
    is_auth_error = status_code == 401
    is_retryable = is_rate_limit or is_overload or is_server_error

    # Auth errors skip retry and go straight to fallback
    if is_auth_error:
        return self._try_activate_fallback(error, reason="auth_error")

    # Rate limit / overload: exponential backoff
    if is_retryable and attempt < max_attempts:
        backoff = min(2 ** attempt, 60)
        time.sleep(backoff)
        return "retry"

    # Exhausted retries for primary — try fallback chain
    if is_retryable and self._fallback_chain:
        return self._try_activate_fallback(error, reason="rate_limit_exhausted")

    raise error


def _try_activate_fallback(self, error, reason: str) -> str:
    """Activate the next provider in the fallback chain.

    Returns "switched_to_fallback" continuation reason so the agent loop
    re-enters with the new provider WITHOUT returning an error to the user.
    """
    if self._fallback_index >= len(self._fallback_chain):
        # All fallbacks exhausted
        raise error

    fallback = self._fallback_chain[self._fallback_index]
    self._fallback_index += 1
    self._fallback_activated = True

    # Reconfigure the agent to use the fallback provider
    self.model = fallback["model"]
    self.provider = fallback["provider"]
    self._reinit_client_for_fallback(fallback)

    logger.warning(
        "Switched to fallback provider %s/%s (reason: %s)",
        self.provider, self.model, reason
    )
    return "switched_to_fallback"


# ── run_agent.py: ~7500-7600 — main agent loop: error handling section ──────
# The agent loop treats most errors as continuation events, not hard failures.
#
# while iteration < max_iterations:
#     try:
#         response = self._make_api_call(messages)
#     except RateLimitError as e:
#         continuation_reason = self._handle_api_error(e, attempt, max_attempts)
#         if continuation_reason in ("retry", "switched_to_fallback"):
#             continue  # re-enter loop with same messages
#         raise
#     except ConnectionError as e:
#         if attempt < max_attempts:
#             time.sleep(2 ** attempt)
#             continue
#         raise
#
#     # Normal execution continues...
#     tool_calls = extract_tool_calls(response)
#     if not tool_calls:
#         break  # Model chose to stop
#     execute_tools(tool_calls)
#     # Loop back to make next API call
