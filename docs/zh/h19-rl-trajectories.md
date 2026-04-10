# h19 — RL & Trajectories：ShareGPT 轨迹生成与训练数据流水线

> **核心洞察**：不是所有轨迹都值得训练——过滤和格式化才是数据生成流水线的核心。

---

## 什么是 RL Trajectory？

一次完整的 agent 对话（从用户输入到最终回答，含所有 tool_calls 和 tool_results）就是一条 **trajectory（轨迹）**。

高质量的轨迹可以用于：
- **Supervised Fine-tuning (SFT)**：让模型学习 agent 行为模式
- **RLHF/RLAIF**：作为 reward 模型的训练数据
- **Atropos RL environment**：用于强化学习训练环境

---

## ShareGPT 格式：标准化轨迹表示

```json
{
  "conversations": [
    {
      "from": "human",
      "value": "帮我分析这段 Python 代码的性能问题"
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
      "value": "发现性能问题：`slow_function` 使用了 O(n) 的列表操作，建议改用集合。"
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

## BatchRunner：并行轨迹生成

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
        并行执行所有任务，收集轨迹文件路径。
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
        """执行单个任务，记录轨迹，保存到文件"""
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

## TrajectoryRecorder：记录完整轨迹

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

## trajectory_compressor：过滤低质量轨迹

```python
class TrajectoryFilter:
    """
    过滤掉不值得训练的轨迹：
    """

    MIN_TURNS = 2       # 少于 2 轮的轨迹通常无意义
    MAX_TURNS = 50      # 超过 50 轮可能是失控的循环
    MAX_TOKENS = 32000  # 超过 token 上限的轨迹不适合训练

    def is_valid(self, trajectory: dict) -> bool:
        meta = trajectory.get("metadata", {})
        convs = trajectory.get("conversations", [])

        # 基本轮次过滤
        if not (self.MIN_TURNS <= len(convs) <= self.MAX_TURNS):
            return False

        # 必须以人类消息开始，以 gpt 消息结束
        if not convs or convs[0]["from"] != "human":
            return False
        if convs[-1]["from"] not in ("gpt", "assistant"):
            return False

        # 失败标记的轨迹不纳入训练集
        if meta.get("success") is False:
            return False

        # token 估算上限
        total_chars = sum(len(c["value"]) for c in convs)
        if total_chars // 4 > self.MAX_TOKENS:
            return False

        return True
```

---

## Atropos RL Environment 接入

Atropos 是一个 RL 训练框架，Hermes 通过实现 `AtroposEnv` 接口接入：

```python
class HermesAtroposEnv:
    """
    把 Hermes agent 包装成 Atropos RL 环境。
    """
    def reset(self, task: dict) -> str:
        """重置环境，返回初始 observation（task prompt）"""
        self.agent = AIAgent()
        self.recorder = TrajectoryRecorder(task["id"])
        self.agent.trajectory_recorder = self.recorder
        return task["prompt"]

    def step(self, action: str) -> tuple[str, float, bool]:
        """
        执行一步：
        action = agent 的输出（tool_call 或 final answer）
        返回 (observation, reward, done)
        """
        # 评估 reward（简化示例）
        if self._is_done(action):
            reward = self._compute_reward()
            return "", reward, True
        return self._get_next_obs(action), 0.0, False

    def _compute_reward(self) -> float:
        """
        reward 计算示例：
        - 任务完成 +1.0
        - 工具调用次数过多 -0.1/次
        - 包含错误输出 -0.5
        """
        trajectory = self.recorder.to_sharegpt()
        num_tools = len(trajectory["metadata"]["tools_used"])
        base_reward = 1.0
        efficiency_penalty = max(0, num_tools - 5) * 0.1
        return base_reward - efficiency_penalty
```

---

## 代码解读：snippets/h19_rl_training.py

本章 Code 标签展示 `batch_runner.py` 和 `agent/trajectory.py` 的精选片段，关注：

1. **`BatchRunner.run_batch()`** — ThreadPoolExecutor 并行生成
2. **`TrajectoryRecorder.to_sharegpt()`** — messages → ShareGPT 格式转换
3. **`TrajectoryFilter.is_valid()`** — 多维度质量过滤规则

---

## 常见误区

**误区 1**：数量多的轨迹集比质量高的更好  
→ 低质量轨迹（失败的、循环的、格式错误的）会降低训练效果。`TrajectoryFilter` 的过滤至关重要。

**误区 2**：所有 tool_call 都应该记录到轨迹  
→ 某些辅助 tool_call（如 memory_write、session_search）可能需要从训练集中移除，避免模型学习特定于 Hermes 的内部操作。

**误区 3**：reward 函数应该只看最终结果  
→ 过程 reward（工具效率、输出质量）往往比单纯的成功/失败标志更信息丰富，能引导模型学习更高效的 agent 行为。
