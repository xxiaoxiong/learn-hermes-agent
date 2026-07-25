# h21 — 多 Agent Kanban：从委托到持久编排

> 单次 `delegate_task` 解决“把一个子任务交出去”；Kanban 解决“让一组有依赖的任务可靠地协同完成”。

## 1. 架构升级

Hermes 当前的多 Agent 能力包含两条路径：

1. `delegate_task`：适合一个或一批相对独立的子任务。child 拥有隔离上下文和终端会话，只把最终摘要带回父级。
2. Kanban：适合持续、多阶段、可恢复的工程。orchestrator 自动拆解目标，维护任务状态与依赖，worker lane 领取 ready tasks，并在完成后回到父级验证和综合。

## 2. 真正的四个边界

- **所有权**：同一任务同一时间只能被一个 worker 领取。
- **依赖**：上游完成前，下游保持 blocked。
- **隔离**：代码任务可使用 task-specific worktree，避免并行覆盖。
- **恢复**：board 状态与产出必须持久化，进程重启后可以继续。

## 3. 为什么“并发更多”不是答案

并发会放大冲突、重复劳动和上下文噪音。如果没有任务图、验收条件与结果综合，三个 Agent 往往只是更快地产生三份互相矛盾的答案。Hermes 的编排重点因此放在任务生命周期，而不只是一组并行模型调用。

## 4. v0.19 可观测性

后台 delegation 返回可追踪的 handle；每个 child 都有可实时查看的 transcript。结果通过持久化所有权记录恢复并回投，orchestrator 子 Agent 会等待自己的 workers，再综合后返回。

**对应官方源码区域**：`tools/delegate_tool.py`、Kanban worker 与任务板模块。
