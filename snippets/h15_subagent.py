# ============================================================
# H15: Subagent Delegation — Hermes Real Source Snippets
# Source: tools/delegate_tool.py
#
# 核心洞察：父 agent 看不见子 agent 的内部过程
# 父 agent 只看到：delegation call → summary result
# 子 agent 拥有独立 context，不共享父 agent 的对话历史。
# 子 agent 有严格的工具黑名单，无法再度委托（防递归炸弹）。
# ============================================================


# ── tools/delegate_tool.py: 29-40 — design constraints ─────────────────────
# Tools that children must NEVER have access to
DELEGATE_BLOCKED_TOOLS = frozenset([
    "delegate_task",   # no recursive delegation (depth bomb prevention)
    "clarify",         # no user interaction from subagent
    "memory",          # no writes to shared MEMORY.md (would corrupt parent)
    "send_message",    # no cross-platform side effects
    "execute_code",    # children should reason step-by-step, not write scripts
])

MAX_CONCURRENT_CHILDREN = 3   # parallel subagent limit
MAX_DEPTH = 2                  # parent (0) → child (1) → grandchild rejected (2)
DEFAULT_MAX_ITERATIONS = 50


# ── tools/delegate_tool.py: 48-80 — child system prompt ────────────────────
def _build_child_system_prompt(goal: str, context: str = None, *, workspace_path: str = None) -> str:
    """Build a focused system prompt for a child agent.

    KEY: the child gets NO parent conversation history.
    All needed context must be explicitly passed via the 'context' argument.
    """
    parts = [
        "You are a focused subagent working on a specific delegated task.",
        "",
        f"YOUR TASK:\n{goal}",
    ]
    if context and context.strip():
        parts.append(f"\nCONTEXT:\n{context}")
    if workspace_path and str(workspace_path).strip():
        parts.append(
            "\nWORKSPACE PATH:\n"
            f"{workspace_path}\n"
            "Use this exact path for local repository/workdir operations."
        )
    parts.append(
        "\nComplete this task using the tools available to you. "
        "When finished, provide a clear, concise summary of:\n"
        "- What you did\n"
        "- What you found or accomplished\n"
        "- Any files you created or modified\n"
        "- Any issues encountered\n\n"
        "Be thorough but concise -- your response is returned to the parent agent as a summary."
    )
    return "\n".join(parts)


# ── tools/delegate_tool.py: 510-640 — delegate_task() main dispatch ─────────
def delegate_task(
    goal: str = None,
    context: str = None,
    toolsets: list = None,
    tasks: list = None,
    max_iterations: int = None,
    parent_agent=None,
) -> str:
    """Spawn one or more subagents to work on tasks in isolated contexts.

    Two modes:
      1. Single task: provide 'goal' (+ optional context, toolsets)
      2. Batch (parallel): provide 'tasks' array with up to 3 items.
         All run concurrently via ThreadPoolExecutor.

    Returns JSON: {"success": true, "results": [...]}
    """
    from run_agent import AIAgent
    from concurrent.futures import ThreadPoolExecutor, as_completed

    if parent_agent is None:
        return tool_error("delegate_task requires a parent agent context.")

    # Depth guard: prevent recursive delegation
    depth = getattr(parent_agent, '_delegate_depth', 0)
    if depth >= MAX_DEPTH:
        return tool_error(f"Maximum delegation depth ({MAX_DEPTH}) reached.")

    # Normalize single task to tasks list for unified handling
    if tasks:
        task_list = tasks[:MAX_CONCURRENT_CHILDREN]
    elif goal:
        task_list = [{"goal": goal, "context": context, "toolsets": toolsets}]
    else:
        return tool_error("Either 'goal' or 'tasks' must be provided.")

    # Build all child agents synchronously (thread-safe)
    children = []
    for i, task in enumerate(task_list):
        child = _build_child_agent(
            task_index=i,
            goal=task.get("goal", ""),
            context=task.get("context"),
            toolsets=task.get("toolsets") or toolsets or DEFAULT_TOOLSETS,
            model=task.get("model"),
            max_iterations=max_iterations or DEFAULT_MAX_ITERATIONS,
            parent_agent=parent_agent,
        )
        children.append((i, task, child))

    # Run in parallel with progress relay to parent's spinner
    results = [None] * len(children)
    with ThreadPoolExecutor(max_workers=MAX_CONCURRENT_CHILDREN) as executor:
        futures = {}
        for i, task, child in children:
            child._delegate_depth = depth + 1   # depth counter on child
            progress_cb = _build_child_progress_callback(i, parent_agent, len(children))
            if progress_cb:
                child.tool_progress_callback = progress_cb
            future = executor.submit(
                child.run_conversation,
                task.get("goal", ""),
                quiet_mode=True,
            )
            futures[future] = i

        for future in as_completed(futures):
            idx = futures[future]
            try:
                result = future.result()
                results[idx] = {"success": True, "result": result}
            except Exception as e:
                results[idx] = {"success": False, "error": str(e)}

    return json.dumps({"success": True, "results": results})
