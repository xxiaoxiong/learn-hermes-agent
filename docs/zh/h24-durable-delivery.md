# h24 — 可靠投递与可观测性：生成之后才是生产问题

> Agent 生成了最终答案，不等于用户已经收到答案。v0.19 用投递义务账本关闭了这个长期被忽略的崩溃窗口。

## 1. 崩溃窗口

旧路径通常是：生成结果 → 平台发送。如果进程在“生成完成”与“平台确认”之间崩溃，这份已付费、已完成的结果可能静默丢失。

新路径把投递建模为持久状态机：

```
final response
  → record obligation in state.db
  → send through platform adapter
  → receive acknowledgement
  → mark obligation complete
```

未确认义务会在下次启动时恢复并重投。幂等键用于避免恢复过程造成重复消息。

## 2. 子 Agent 可观测性

每个 delegation child 都可以产生人类可读的实时 transcript，包含工具调用、结果与流式回复。后台任务的完成记录也具备持久所有权，进程重启后仍能恢复并投递。

## 3. 生产级完成定义

一个可靠任务至少需要：

- 输出已经生成
- 结果已持久记录
- 投递状态可观察
- 目标平台已确认，或存在可恢复的重试义务

这也是 Hermes 从“会做事的 Agent”走向“可长期运行的 Agent 系统”的最后一段闭环。

**对应官方源码区域**：gateway delivery obligation ledger、`state.db`、background delegation ledger。
