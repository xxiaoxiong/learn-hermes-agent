# ============================================================
# H13: Cron Scheduler — Hermes Real Source Snippets
# Source: cron/jobs.py, cron/scheduler.py
#
# 核心洞察：cron job 和普通对话的区别只是触发方式
# cron 调度器每 60 秒执行一次 tick()；
# tick() 找到到期的 job，调用 run_job()，它内部创建一个真正的 AIAgent。
# 对 AIAgent 而言，cron job 和用户手动消息没有区别。
# ============================================================


# ── cron/jobs.py: 30-38 — file layout ───────────────────────────────────────
# All cron data lives under HERMES_HOME/cron/
# Jobs: ~/.hermes/cron/jobs.json
# Output: ~/.hermes/cron/output/{job_id}/{timestamp}.md
from pathlib import Path
from hermes_constants import get_hermes_home

HERMES_DIR = get_hermes_home()
CRON_DIR = HERMES_DIR / "cron"
JOBS_FILE = CRON_DIR / "jobs.json"
OUTPUT_DIR = CRON_DIR / "output"


# ── cron/jobs.py: 96-140 — schedule parsing ─────────────────────────────────
def parse_duration(s: str) -> int:
    """Parse duration string into minutes.

    Examples: "30m" -> 30, "2h" -> 120, "1d" -> 1440, "90" -> 90
    """
    s = s.strip().lower()
    if s.endswith("m"):
        return int(s[:-1])
    elif s.endswith("h"):
        return int(s[:-1]) * 60
    elif s.endswith("d"):
        return int(s[:-1]) * 1440
    else:
        return int(s)


# ── cron/jobs.py: 468-555 — _build_job_prompt() with skill attachment ───────
def _build_job_prompt(job: dict) -> str:
    """Build the effective prompt for a cron job, optionally loading one or more skills first.

    KEY: cron jobs can run with skills preloaded — same mechanism as /skill in CLI.
    The skill content is prepended to the prompt as a user message.
    """
    import json
    from tools.skills_tool import skill_view

    prompt = job.get("prompt", "")
    skills = job.get("skills") or ([job["skill"]] if job.get("skill") else [])

    # Cron-system hint: model should stay silent unless it has something to report
    cron_hint = (
        "[SYSTEM: This is an automated cron job. Only respond if there are "
        "findings worth reporting. Otherwise say [SILENT] and nothing more.]\n\n"
    )
    prompt = cron_hint + prompt

    skill_names = [str(name).strip() for name in skills if str(name).strip()]
    if not skill_names:
        return prompt

    parts = []
    for skill_name in skill_names:
        loaded = json.loads(skill_view(skill_name))
        if not loaded.get("success"):
            continue
        content = str(loaded.get("content") or "").strip()
        if content:
            parts.append("")
        parts.extend([
            f'[SYSTEM: The user has invoked the "{skill_name}" skill, '
            "indicating they want you to follow its instructions. "
            "The full skill content is loaded below.]",
            "",
            content,
        ])

    if prompt:
        parts.extend(["", f"The user has provided the following instruction: {prompt}"])
    return "\n".join(parts)


# ── cron/scheduler.py: 558-720 — run_job() creates a real AIAgent ────────────
def run_job(job: dict) -> tuple:
    """Execute a single cron job.

    Returns: (success, full_output_doc, final_response, error_message)

    KEY: cron jobs run through the exact same AIAgent loop as CLI conversations.
    The only difference is the trigger mechanism (time-based vs user input).
    """
    from run_agent import AIAgent

    job_id = job.get("id", "unknown")
    prompt = _build_job_prompt(job)

    # Create a standard AIAgent — same class used for all CLI/gateway sessions
    agent = AIAgent(
        model=job.get("model") or get_default_model(),
        api_key=resolve_api_key(job),
        base_url=resolve_base_url(job),
        quiet_mode=True,           # no CLI output for cron jobs
        skip_memory=True,          # cron agents don't write to MEMORY.md
        session_id=f"cron-{job_id}-{int(time.time())}",
    )

    # Run as a single-turn conversation
    response = agent.run_conversation(prompt)
    return True, build_output_doc(job, response), response, None


# ── cron/scheduler.py: 870-960 — tick() with file lock ───────────────────────
def tick(verbose: bool = True, adapters=None, loop=None) -> int:
    """Check and run all due jobs.

    Uses a file lock so only one tick runs at a time, even if gateway's
    in-process ticker and a standalone daemon or manual tick overlap.

    Called every 60 seconds by the gateway background thread.

    Returns:
        Number of jobs executed (0 if another tick is already running).
    """
    # File-based lock prevents concurrent ticks
    _LOCK_DIR.mkdir(parents=True, exist_ok=True)
    lock_fd = None
    try:
        lock_fd = open(_LOCK_FILE, "w")
        # fcntl.flock (Unix) or msvcrt.locking (Windows)
        acquire_lock(lock_fd)
    except (OSError, IOError):
        logger.debug("Tick skipped — another instance holds the lock")
        if lock_fd:
            lock_fd.close()
        return 0

    executed = 0
    try:
        due_jobs = get_due_jobs()
        for job in due_jobs:
            advance_next_run(job["id"])          # advance schedule before running
            success, output, final_response, error = run_job(job)
            save_job_output(job["id"], output)
            executed += 1

            # Deliver output to gateway adapters if available
            if adapters and final_response and "[SILENT]" not in final_response:
                deliver_cron_output(job, final_response, adapters, loop)
    finally:
        release_lock(lock_fd)
        lock_fd.close()

    return executed
