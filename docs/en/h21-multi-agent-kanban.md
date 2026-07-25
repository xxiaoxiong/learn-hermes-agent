# h21 — Multi-Agent Kanban: From Delegation to Durable Orchestration

One-shot `delegate_task` answers “who can handle this subtask?” Kanban answers “how can a dependency graph of tasks finish reliably?”

Hermes now has two complementary paths. Delegation fits one or several independent subtasks: children run with isolated context and terminal sessions, and only their final summaries enter the parent context. Kanban fits longer, staged work: an orchestrator decomposes the goal, tracks task dependencies and ownership, sends ready work into worker lanes, and synthesizes verified results.

The four important boundaries are ownership, dependency, isolation, and recovery. Code tasks may receive task-specific worktrees; blocked tasks wait for prerequisites; board state and artifacts survive restarts.

More concurrency is not the goal. Without a task graph and acceptance criteria, parallel agents simply produce conflicting output faster. Hermes therefore treats the task lifecycle as the core orchestration primitive.

**Official source areas:** `tools/delegate_tool.py`, Kanban workers, and board-state modules.
