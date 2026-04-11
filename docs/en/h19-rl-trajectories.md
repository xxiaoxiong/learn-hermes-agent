# h19 — RL & Trajectories: ShareGPT Trajectory Generation and Training Data Pipeline

> **Core Insight**: Not all trajectories are worth training on — filtering and formatting are the core of the data generation pipeline.

---

## What Is an RL Trajectory?

A complete agent conversation (from user input to final answer, including all tool_calls and tool_results) is a **trajectory**.

High-quality trajectories can be used for:
- **Supervised Fine-tuning (SFT)**: Teaching models agent behavior patterns
- **RLHF/RLAIF**: Training data for reward models
- **Atropos RL environment**: For reinforcement learning training environments

---

## ShareGPT Format: Standardized Trajectory Representation

```json
{
  "conversations": [
    {
      "from": "human",
      "value": "Help me analyze the performance issues in this Python code"
    },
    {
      "from": "gpt",
      "value": "<tool_call>\n{\"name\": \"read_file\", \"arguments\": {\"path\": \"main.py\"}}\n</tool_call>"
    },
    {
      "from": "tool",
      "value": "def slow_function():\n    for i in range(1000000):\n        ..."
    },
    {
      "from": "gpt",
      "value": "Found a performance issue: `slow_function` uses an O(n) list operation. Recommend switching to a set."
    }
  ],
  "metadata": {
    "task_id": "perf-001",
    "success": true,
    "num_turns": 3,
    "tools_used": ["read_file"],
    "total_tokens": 1240
  }
}
```

---

## BatchRunner: Parallel Trajectory Generation

```python
from concurrent.futures import ThreadPoolExecutor, as_completed
import json

class BatchRunner:
    def __init__(self, max_workers: int = 8, output_dir: str = "trajectories"):
        self.max_workers = max_workers
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def run_batch(self, tasks: list[dict]) -> list[str]:
        """
        Execute all tasks in parallel and collect trajectory file paths.
        tasks: [{"id": "task-001", "prompt": "..."}, ...]
        """
        results = []
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = {
                executor.submit(self._run_single, task): task["id"]
                for task in tasks
            }
            for future in as_completed(futures):
                task_id = futures[future]
                try:
                    path = future.result()
                    results.append(path)
                    print(f"✅ {task_id}: {path}")
                except Exception as e:
                    print(f"❌ {task_id}: {e}")

        return results

    def _run_single(self, task: dict) -> str:
        """Execute a single task, record the trajectory, and save to file"""
        recorder = TrajectoryRecorder(task["id"])
        agent = AIAgent(trajectory_recorder=recorder)
        agent.run_conversation(task["prompt"])

        trajectory = recorder.to_sharegpt()
        output_path = os.path.join(self.output_dir, f"{task['id']}.json")
        with open(output_path, "w") as f:
            json.dump(trajectory, f, ensure_ascii=False, indent=2)

        return output_path
```

---

## TrajectoryRecorder: Recording the Complete Trajectory

```python
class TrajectoryRecorder:
    def __init__(self, task_id: str):
        self.task_id = task_id
        self._turns: list[dict] = []
        self._metadata: dict = {"task_id": task_id, "tools_used": set()}

    def record_user(self, text: str) -> None:
        self._turns.append({"from": "human", "value": text})

    def record_assistant(self, text: str) -> None:
        self._turns.append({"from": "gpt", "value": text})

    def record_tool_call(self, name: str, args: dict) -> None:
        call_text = f'<tool_call>\n{json.dumps({"name": name, "arguments": args})}\n</tool_call>'
        self._turns.append({"from": "gpt", "value": call_text})
        self._metadata["tools_used"].add(name)

    def record_tool_result(self, result: str) -> None:
        self._turns.append({"from": "tool", "value": result})

    def to_sharegpt(self) -> dict:
        self._metadata["num_turns"] = len(self._turns)
        self._metadata["tools_used"] = list(self._metadata["tools_used"])
        return {"conversations": self._turns, "metadata": self._metadata}
```

---

## trajectory_compressor: Filtering Low-Quality Trajectories

```python
class TrajectoryFilter:
    """
    Filter out trajectories not worth training on:
    """

    MIN_TURNS = 2       # Trajectories with fewer than 2 turns are usually meaningless
    MAX_TURNS = 50      # More than 50 turns likely indicates a runaway loop
    MAX_TOKENS = 32000  # Trajectories exceeding the token limit are unsuitable for training

    def is_valid(self, trajectory: dict) -> bool:
        meta = trajectory.get("metadata", {})
        convs = trajectory.get("conversations", [])

        # Basic turn count filtering
        if not (self.MIN_TURNS <= len(convs) <= self.MAX_TURNS):
            return False

        # Must start with a human message and end with a gpt message
        if not convs or convs[0]["from"] != "human":
            return False
        if convs[-1]["from"] not in ("gpt", "assistant"):
            return False

        # Trajectories marked as failed are excluded from the training set
        if meta.get("success") is False:
            return False

        # Token estimate upper bound
        total_chars = sum(len(c["value"]) for c in convs)
        if total_chars // 4 > self.MAX_TOKENS:
            return False

        return True
```

---

## Atropos RL Environment Integration

Atropos is an RL training framework; Hermes integrates by implementing the `AtroposEnv` interface:

```python
class HermesAtroposEnv:
    """
    Wrap the Hermes agent as an Atropos RL environment.
    """
    def reset(self, task: dict) -> str:
        """Reset the environment and return the initial observation (task prompt)"""
        self.agent = AIAgent()
        self.recorder = TrajectoryRecorder(task["id"])
        self.agent.trajectory_recorder = self.recorder
        return task["prompt"]

    def step(self, action: str) -> tuple[str, float, bool]:
        """
        Execute one step:
        action = agent's output (tool_call or final answer)
        Returns (observation, reward, done)
        """
        # Evaluate reward (simplified example)
        if self._is_done(action):
            reward = self._compute_reward()
            return "", reward, True
        return self._get_next_obs(action), 0.0, False

    def _compute_reward(self) -> float:
        """
        Reward calculation example:
        - Task completed: +1.0
        - Too many tool calls: -0.1 per call
        - Contains error output: -0.5
        """
        trajectory = self.recorder.to_sharegpt()
        num_tools = len(trajectory["metadata"]["tools_used"])
        base_reward = 1.0
        efficiency_penalty = max(0, num_tools - 5) * 0.1
        return base_reward - efficiency_penalty
```

---

## Code Walkthrough: snippets/h19_rl_training.py

The Code tab for this chapter shows curated snippets from `batch_runner.py` and `agent/trajectory.py`, focusing on:

1. **`BatchRunner.run_batch()`** — ThreadPoolExecutor parallel generation
2. **`TrajectoryRecorder.to_sharegpt()`** — messages → ShareGPT format conversion
3. **`TrajectoryFilter.is_valid()`** — Multi-dimensional quality filtering rules

---

## Common Misconceptions

**Misconception 1**: A larger trajectory set is better than a higher-quality one  
→ Low-quality trajectories (failed, looping, malformed) degrade training effectiveness. `TrajectoryFilter` filtering is critical.

**Misconception 2**: All tool_calls should be recorded in the trajectory  
→ Some auxiliary tool_calls (like memory_write, session_search) may need to be removed from the training set to prevent the model from learning Hermes-specific internal operations.

**Misconception 3**: The reward function should only look at the final result  
→ Process rewards (tool efficiency, output quality) are often more informative than a simple success/failure flag and can guide the model toward more efficient agent behavior.
