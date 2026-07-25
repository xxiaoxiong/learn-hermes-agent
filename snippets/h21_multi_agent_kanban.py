"""
h21 — Multi-agent Kanban (Hermes Agent v0.19 architecture sketch)

The current design upgrades one-shot delegation into a persistent task graph:
an orchestrator decomposes work, ready tasks enter worker lanes, code tasks may
receive isolated worktrees, and completed artifacts return for synthesis.
"""

from dataclasses import dataclass, field
from enum import Enum


class Status(str, Enum):
    BLOCKED = "blocked"
    READY = "ready"
    RUNNING = "running"
    DONE = "done"


@dataclass
class Task:
    id: str
    goal: str
    depends_on: set[str] = field(default_factory=set)
    owner: str | None = None
    status: Status = Status.BLOCKED
    artifact: str | None = None


def refresh_ready(tasks: list[Task]) -> None:
    completed = {task.id for task in tasks if task.status == Status.DONE}
    for task in tasks:
        if task.status == Status.BLOCKED and task.depends_on <= completed:
            task.status = Status.READY


def claim(task: Task, worker_id: str) -> None:
    if task.status != Status.READY:
        raise RuntimeError("only ready tasks may be claimed")
    task.owner = worker_id
    task.status = Status.RUNNING
