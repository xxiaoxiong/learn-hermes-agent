# h13 — Cron Scheduler：带完整 Agent 能力的定时任务

> **核心洞察**：cron job 不是 shell 脚本——它是一个带完整 agent 能力的定时任务，可绑定 skill 作为执行上下文。

---

## 问题：如何让 agent 在无人在场时自动执行任务？

常规 cron 任务（shell 脚本）的局限：
- 只能执行预定义的命令序列，不能根据情况灵活决策
- 无法调用工具处理异常
- 结果只能写日志，无法发回到用户

Hermes 的 cron job 是一个**完整的 agent 执行**：启动一个 fresh AIAgent，用 prompt 描述任务，让 agent 自主完成，结果发回指定平台。

---

## jobs.json：cron job 数据结构

```json
[
  {
    "id": "daily-summary",
    "name": "每日工作摘要",
    "prompt": "检查今天的 git 提交记录，总结主要变更，生成一份简洁的日报",
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
    "name": "每周文件清理",
    "prompt": "清理 /tmp 目录中超过 7 天的文件，报告清理了多少空间",
    "schedule": "0 9 * * 1",
    "skill_attachment": null,
    "target_platform": "cli",
    "target_chat_id": null,
    "enabled": true
  }
]
```

---

## 调度触发机制

```python
import time
from datetime import datetime
from croniter import croniter  # cron 表达式解析库

class Scheduler:
    def __init__(self, jobs_file: str = "cron/jobs.json"):
        self.jobs_file = jobs_file

    def run(self) -> None:
        """主调度循环：每分钟检查一次待执行的 job"""
        while True:
            self._tick()
            time.sleep(60)

    def _tick(self) -> None:
        """检查所有 job，触发到期的任务"""
        now = datetime.utcnow()
        jobs = self._load_jobs()

        for job in jobs:
            if not job["enabled"]:
                continue
            if self._should_run(job, now):
                self._execute_job(job)
                self._update_last_run(job["id"], now)

    def _should_run(self, job: dict, now: datetime) -> bool:
        """检查 cron 表达式是否到期"""
        cron = croniter(job["schedule"], now)
        prev_run = cron.get_prev(datetime)
        last_run = job.get("last_run")
        if last_run is None:
            return True  # 从未运行过
        return prev_run > datetime.fromisoformat(last_run)
```

---

## 执行 Job：创建 fresh AIAgent

每次执行 cron job 都创建一个**全新的 AIAgent 实例**，确保上下文隔离：

```python
def _execute_job(self, job: dict) -> None:
    """
    执行一个 cron job：
    1. 创建 fresh AIAgent（干净的 messages 列表）
    2. 如果有 skill_attachment，注入对应 skill
    3. 运行 agent，获取结果
    4. 发送结果到目标平台
    """
    agent = AIAgent()  # fresh 实例，messages = []

    # skill_attachment：把特定 skill 注入为 user message 的前置内容
    prompt = job["prompt"]
    if job.get("skill_attachment"):
        skill = load_skill(job["skill_attachment"])
        if skill:
            prompt = f"[Skill: {skill.name}]\n\n{skill.content}\n\n---\n\n{prompt}"

    result = agent.run_conversation(prompt)

    # 发送到目标平台
    delivery = DeliveryManager()
    delivery.send(
        platform=job["target_platform"],
        chat_id=job["target_chat_id"],
        text=f"📋 **{job['name']}** 执行结果：\n\n{result}",
    )
```

---

## skill_attachment 的作用

`skill_attachment` 让 cron job 携带特定领域的操作指南：

```
job "daily-summary" + skill "git-reporter"
    ↓
agent 的任务变为：
  "[Skill: git-reporter]
   处理 git 操作时，请关注：提交频率、文件变更范围、作者分布…
   ---
   检查今天的 git 提交记录，总结主要变更，生成一份简洁的日报"
```

skill 不是代替 prompt，而是为 prompt 提供执行上下文。

---

## Delivery Layer：与 Gateway 共用

cron job 的结果发送与 Gateway（h12）共用同一套 delivery 层：

```python
class DeliveryManager:
    def __init__(self, adapters: dict[str, PlatformAdapter]):
        self.adapters = adapters  # platform → adapter

    def send(self, platform: str, chat_id: str, text: str) -> None:
        adapter = self.adapters.get(platform)
        if adapter:
            adapter.deliver(chat_id, text)
        else:
            print(f"[Cron Result] {text}")  # fallback 到 stdout
```

---

## 代码解读：snippets/h13_cron_scheduler.py

本章 Code 标签展示 `cron/jobs.py` 和 `cron/scheduler.py` 的精选片段，关注：

1. **`Scheduler._tick()`** — 每分钟检查逻辑
2. **job 执行流** — fresh AIAgent + skill injection + delivery
3. **`next_run` 计算** — 基于 cron 表达式的时间推算

---

## 常见误区

**误区 1**：cron job 的 agent 应该复用当前 session  
→ cron job 必须用 fresh AIAgent。复用 session 会把用户对话历史带入自动任务，造成上下文污染。

**误区 2**：`skill_attachment` 替代了 job 的 `prompt`  
→ 不替代，而是前置注入。skill 是操作指南，prompt 是具体任务。两者结合，agent 才知道"用什么方式做什么事"。

**误区 3**：调度精度是秒级  
→ `_tick()` 每分钟执行一次，精度是分钟级，与标准 cron 一致。秒级调度在大多数 agent 场景下没有必要。
