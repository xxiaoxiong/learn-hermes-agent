# ============================================================
# H19: RL Training (Atropos) — Hermes Real Source Snippets
# Source: environments/hermes_base_env.py, agent/trajectory.py
#
# 核心洞察：RL 训练就是在受控环境中跑 agent loop
# Atropos 环境封装了：
#   1. HermesAgentLoop 执行 rollout（调用真实 agent）
#   2. compute_reward() 给 trajectory 评分
#   3. ScoredDataGroup 封装 (trajectory, reward) 对
# 再由 Atropos 把 scored data 送给 GRPO/PPO trainer
# ============================================================


# ── environments/hermes_base_env.py: 221-244 — environment contract ──────────
"""
HermesAgentBaseEnv — Abstract Base Environment for Hermes + Atropos

Two operation modes:
  Phase 1 (OpenAI server): Uses server.chat_completion() directly.
    SFT data gen, verifier testing, evaluation.

  Phase 2 (VLLM server): Full RL training capability.
    Uses ManagedServer for exact token IDs + logprobs via /generate.
    Client-side tool call parser reconstructs structured tool_calls.

Subclasses must implement:
    setup()           -- Load dataset, initialize state
    get_next_item()   -- Return the next item to roll out
    format_prompt()   -- Convert a dataset item into the user message string
    compute_reward()  -- Score the rollout using ToolContext
    evaluate()        -- Periodic evaluation
"""


# ── environments/hermes_base_env.py: 289-330 — per-group toolset resolution ──
def _resolve_tools_for_group(self):
    """Resolve toolsets for a group.

    If distribution is set, samples probabilistically.
    If enabled_toolsets is set, uses that explicit list.
    disabled_toolsets is applied as a filter on top.

    KEY: different training groups can have different tool distributions,
    teaching the model to work with varying toolsets.
    """
    config = self.config

    if config.distribution:
        group_toolsets = sample_toolsets_from_distribution(config.distribution)
    else:
        group_toolsets = config.enabled_toolsets   # None = all available

    tools = get_tool_definitions(
        enabled_toolsets=group_toolsets,
        disabled_toolsets=config.disabled_toolsets,
        quiet_mode=True,
    )
    valid_tool_names = {t["function"]["name"] for t in tools}
    return tools, valid_tool_names


# ── environments/hermes_base_env.py: ~370-440 — collect_trajectory() ─────────
async def collect_trajectory(self, item) -> list:
    """Execute one rollout on a single dataset item.

    Steps:
    1. Format the item into a user prompt
    2. Run the HermesAgentLoop (real AIAgent loop)
    3. Compute reward from ToolContext
    4. Return [(prompt_tokens, response_tokens, reward), ...]
    """
    prompt = self.format_prompt(item)
    tools, valid_tool_names = self._current_group_tools

    # Run the real agent loop — uses the same code as CLI conversations
    result: AgentResult = await HermesAgentLoop.run(
        prompt=prompt,
        tools=tools,
        valid_tool_names=valid_tool_names,
        model=self.config.model,
        server=self.server,
        max_iterations=self.config.max_agent_iterations,
    )

    # Build ToolContext from the trajectory for reward computation
    tool_ctx = ToolContext.from_agent_result(result)

    # Subclass implements the reward function
    reward = await self.compute_reward(item, result, tool_ctx)

    # Save trajectory for debugging/analysis
    if self.config.save_trajectories:
        save_trajectory(
            trajectory=result.messages,
            model=str(self.config.model),
            completed=result.completed,
        )

    return self._build_scored_items(result, reward)


# ── agent/trajectory.py: 30-57 — trajectory persistence ─────────────────────
def save_trajectory(trajectory: list, model: str, completed: bool, filename: str = None):
    """Append a trajectory entry to a JSONL file.

    Format: ShareGPT conversation list (same format as OpenAI fine-tuning data).
    Successful rollouts → trajectory_samples.jsonl
    Failed rollouts    → failed_trajectories.jsonl

    Used for:
    1. RL training data collection
    2. Debugging agent behavior
    3. Creating SFT datasets from successful rollouts
    """
    import json
    from datetime import datetime

    if filename is None:
        filename = "trajectory_samples.jsonl" if completed else "failed_trajectories.jsonl"

    entry = {
        "conversations": trajectory,
        "timestamp": datetime.now().isoformat(),
        "model": model,
        "completed": completed,
    }

    try:
        with open(filename, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except Exception as e:
        pass  # Trajectory saving is non-critical


# ── RL training pipeline overview ─────────────────────────────────────────────
#
# Dataset item → format_prompt() → HermesAgentLoop.run() → trajectory
#                                                             ↓
#                                                    compute_reward(ToolContext)
#                                                             ↓
#                                                    ScoredDataGroup
#                                                             ↓
#                                                GRPO/PPO trainer (Atropos)
#                                                             ↓
#                                                  updated model weights
#
# The training loop calls collect_trajectories() (plural) in parallel,
# each evaluating multiple rollouts per group for variance reduction.
