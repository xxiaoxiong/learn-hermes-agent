# ============================================================
# H08: Skills System — Hermes Real Source Snippets
# Source: agent/skill_commands.py, cli.py
#
# 核心洞察：skill 注入为 user message（非 system prompt）
# 原因：system prompt 在首次 API 调用后被 Anthropic prefix cache 缓存。
#       如果把 skill 注入 system prompt，每次激活不同 skill 都会破坏缓存。
#       注入为 user message 则不影响 system prompt 的 cache 命中。
# ============================================================


# ── agent/skill_commands.py: 1-22 ──────────────────────────────────────────
"""
Shared slash command helpers for skills and built-in prompt-style modes.

Shared between CLI (cli.py) and gateway (gateway/run.py) so both surfaces
can invoke skills via /skill-name commands and prompt-only built-ins like /plan.
"""

_skill_commands = {}  # { "/skill-name": {"name": "...", "skill_dir": "..."} }


# ── agent/skill_commands.py: 121-197 ──────────────────────────────────────
# _build_skill_message formats the skill content into a user message payload
def _build_skill_message(
    loaded_skill: dict,
    skill_dir,
    activation_note: str,
    user_instruction: str = "",
    runtime_note: str = "",
) -> str:
    """Format a loaded skill into a user/system message payload."""
    content = str(loaded_skill.get("content") or "")

    # KEY: activation_note clarifies to the model that this is a skill invocation
    parts = [activation_note, "", content.strip()]

    # Inject resolved skill config values (from config.yaml)
    _inject_skill_config(loaded_skill, parts)

    if loaded_skill.get("setup_needed") and loaded_skill.get("setup_note"):
        parts.extend([
            "",
            f"[Skill setup note: {loaded_skill['setup_note']}]",
        ])

    # List supporting files the model can load on demand
    supporting = []
    linked_files = loaded_skill.get("linked_files") or {}
    for entries in linked_files.values():
        if isinstance(entries, list):
            supporting.extend(entries)

    if supporting and skill_dir:
        parts.append("")
        parts.append("[This skill has supporting files you can load with the skill_view tool:]")
        for sf in supporting:
            parts.append(f"- {sf}")

    if user_instruction:
        parts.append("")
        parts.append(f"The user has provided the following instruction alongside the skill invocation: {user_instruction}")

    if runtime_note:
        parts.append("")
        parts.append(f"[Runtime note: {runtime_note}]")

    return "\n".join(parts)


# ── agent/skill_commands.py: 291-326 ──────────────────────────────────────
def build_skill_invocation_message(
    cmd_key: str,
    user_instruction: str = "",
    task_id: str = None,
    runtime_note: str = "",
):
    """Build the user message content for a skill slash command invocation.

    Returns:
        The formatted message string, or None if the skill wasn't found.
    """
    commands = get_skill_commands()
    skill_info = commands.get(cmd_key)
    if not skill_info:
        return None

    loaded = _load_skill_payload(skill_info["skill_dir"], task_id=task_id)
    if not loaded:
        return f"[Failed to load skill: {skill_info['name']}]"

    loaded_skill, skill_dir, skill_name = loaded

    # Activation note tells the model this is a skill invocation
    activation_note = (
        f'[SYSTEM: The user has invoked the "{skill_name}" skill, indicating they want '
        "you to follow its instructions. The full skill content is loaded below.]"
    )
    # Build as USER MESSAGE — not system prompt — to preserve prefix cache
    return _build_skill_message(
        loaded_skill, skill_dir, activation_note,
        user_instruction=user_instruction, runtime_note=runtime_note,
    )


# ── agent/skill_commands.py: 329-368 (preloaded skills for CLI sessions) ──
def build_preloaded_skills_prompt(
    skill_identifiers: list,
    task_id: str = None,
):
    """Load one or more skills for session-wide CLI preloading.

    Returns (prompt_text, loaded_skill_names, missing_identifiers).
    Preloaded skills are also injected as USER MESSAGES, not system prompt.
    """
    prompt_parts = []
    loaded_names = []
    missing = []

    for raw_identifier in skill_identifiers:
        identifier = (raw_identifier or "").strip()
        if not identifier:
            continue

        loaded = _load_skill_payload(identifier, task_id=task_id)
        if not loaded:
            missing.append(identifier)
            continue

        loaded_skill, skill_dir, skill_name = loaded
        activation_note = (
            f'[SYSTEM: The user launched this CLI session with the "{skill_name}" skill '
            "preloaded. Treat its instructions as active guidance for the duration of this "
            "session unless the user overrides them.]"
        )
        prompt_parts.append(_build_skill_message(loaded_skill, skill_dir, activation_note))
        loaded_names.append(skill_name)

    return "\n\n".join(prompt_parts), loaded_names, missing


# ── cli.py: 5070-5082 (CLI dispatch — how /skill-name is handled) ─────────
# In CLISession.process_command():
#
#   elif base_cmd in _skill_commands:
#       user_instruction = cmd_original[len(base_cmd):].strip()
#       msg = build_skill_invocation_message(
#           base_cmd, user_instruction, task_id=self.session_id
#       )
#       if msg:
#           skill_name = _skill_commands[base_cmd]["name"]
#           print(f"\n⚡ Loading skill: {skill_name}")
#           # msg is prepended to the next user message as a user role message
