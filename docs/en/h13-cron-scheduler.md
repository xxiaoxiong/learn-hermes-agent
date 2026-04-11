# h13 — Cron Scheduler: Scheduled Tasks with Full Agent Capabilities

> **Core Insight**: A cron job is not a shell script — it is a scheduled task with full agent capabilities, optionally bound to a skill as execution context.

---

## The Problem: How to Let the Agent Execute Tasks Automatically When No One Is Around?

Limitations of conventional cron tasks (shell scripts):
- Can only execute predefined command sequences; cannot make flexible decisions based on the situation
- Cannot call tools to handle exceptions
- Results can only be written to logs; cannot be sent back to the user

Hermes' cron job is a **complete agent execution**: it launches a fresh AIAgent, describes the task via a prompt, lets the agent complete it autonomously, and delivers the result to a specified platform.

---

## jobs.json: Cron Job Data Structure

```json
[
  {
    "id": "daily-summary",
    "name": "Daily Work Summary",
    "prompt": "Check today's git commit log, summarize the main changes, and generate a concise daily report",
    "schedule": "0 18 * * 1-5",
    "skill_attachment": "git-reporter",
    "target_platform": "telegram",
    "target_chat_id": "123456789",
    "enabled": true,
    "last_run": null,
    "next_run": "2024-01-15T18:00:00Z"
  },
  {
    "id": "weekly-cleanup",
    "name": "Weekly File Cleanup",
    "prompt": "Clean files older than 7 days in /tmp and report how much space was freed",
    "schedule": "0 9 * * 1",
    "skill_attachment": null,
    "target_platform": "cli",
    "target_chat_id": null,
    "enabled": true
  }
]
```

---

## Scheduling Trigger Mechanism

```python
import time
from datetime import datetime
from croniter import croniter  # Cron expression parser

class Scheduler:
    def __init__(self, jobs_file: str = "cron/jobs.json"):
        self.jobs_file = jobs_file

    def run(self) -> None:
        """Main scheduling loop: check for pending jobs every minute"""
        while True:
            self._tick()
            time.sleep(60)

    def _tick(self) -> None:
        """Check all jobs and trigger those that are due"""
        now = datetime.utcnow()
        jobs = self._load_jobs()

        for job in jobs:
            if not job["enabled"]:
                continue
            if self._should_run(job, now):
                self._execute_job(job)
                self._update_last_run(job["id"], now)

    def _should_run(self, job: dict, now: datetime) -> bool:
        """Check if the cron expression is due"""
        cron = croniter(job["schedule"], now)
        prev_run = cron.get_prev(datetime)
        last_run = job.get("last_run")
        if last_run is None:
            return True  # Never run before
        return prev_run > datetime.fromisoformat(last_run)
```

---

## Executing a Job: Create a Fresh AIAgent

Every cron job execution creates a **brand-new AIAgent instance** to ensure context isolation:

```python
def _execute_job(self, job: dict) -> None:
    """
    Execute a cron job:
    1. Create a fresh AIAgent (clean messages list)
    2. If skill_attachment exists, inject the corresponding skill
    3. Run the agent and get the result
    4. Send the result to the target platform
    """
    agent = AIAgent()  # Fresh instance, messages = []

    # skill_attachment: inject a specific skill as prefix content of the user message
    prompt = job["prompt"]
    if job.get("skill_attachment"):
        skill = load_skill(job["skill_attachment"])
        if skill:
            prompt = f"[Skill: {skill.name}]\n\n{skill.content}\n\n---\n\n{prompt}"

    result = agent.run_conversation(prompt)

    # Deliver to the target platform
    delivery = DeliveryManager()
    delivery.send(
        platform=job["target_platform"],
        chat_id=job["target_chat_id"],
        text=f"📋 **{job['name']}** result:\n\n{result}",
    )
```

---

## The Role of skill_attachment

`skill_attachment` lets a cron job carry domain-specific operating guides:

```
job "daily-summary" + skill "git-reporter"
    ↓
The agent's task becomes:
  "[Skill: git-reporter]
   When working with git operations, focus on: commit frequency, file change scope, author distribution…
   ---
   Check today's git commit log, summarize the main changes, and generate a concise daily report"
```

The skill doesn't replace the prompt — it provides execution context for the prompt.

---

## Delivery Layer: Shared with Gateway

Cron job result delivery shares the same delivery layer as Gateway (h12):

```python
class DeliveryManager:
    def __init__(self, adapters: dict[str, PlatformAdapter]):
        self.adapters = adapters  # platform → adapter

    def send(self, platform: str, chat_id: str, text: str) -> None:
        adapter = self.adapters.get(platform)
        if adapter:
            adapter.deliver(chat_id, text)
        else:
            print(f"[Cron Result] {text}")  # Fallback to stdout
```

---

## Code Walkthrough: snippets/h13_cron_scheduler.py

The Code tab for this chapter shows curated snippets from `cron/jobs.py` and `cron/scheduler.py`, focusing on:

1. **`Scheduler._tick()`** — Per-minute check logic
2. **Job execution flow** — Fresh AIAgent + skill injection + delivery
3. **`next_run` calculation** — Time derivation based on cron expressions

---

## Common Misconceptions

**Misconception 1**: The cron job's agent should reuse the current session  
→ Cron jobs must use a fresh AIAgent. Reusing a session brings user conversation history into automated tasks, causing context pollution.

**Misconception 2**: `skill_attachment` replaces the job's `prompt`  
→ It doesn't replace — it prepends. The skill is an operating guide; the prompt is the specific task. Combined, the agent knows "how to do what."

**Misconception 3**: Scheduling precision is at the second level  
→ `_tick()` runs once per minute; precision is at the minute level, consistent with standard cron. Second-level scheduling is unnecessary for most agent scenarios.
