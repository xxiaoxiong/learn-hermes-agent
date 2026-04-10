# h13a — Agentic Cron：为什么定时任务在 Hermes 里不是脚本调度，而是 agent 触发器

> 这页是 `h13` 的延伸。主线章节已经说明 cron job 会启动 fresh `AIAgent`；这份 bridge doc 要把这个设计再往前推一步：**Hermes 的 cron 不只是“按时执行任务”，而是“按时触发一次完整 agent 执行”。**

---

## 先说结论

传统 cron 更像：

- 到点
- 跑一个脚本
- 结束

而 Hermes 的 cron 更像：

- 到点
- 生成一次新的任务上下文
- 触发完整 agent loop
- 把结果送回指定渠道

这意味着 Hermes 的 cron 不是普通调度器外面套了个 LLM，而是把“定时触发”变成了 agent runtime 的一个入口类型。

---

## 1. 为什么“脚本式 cron”不够表达 Hermes 的做法

如果只是 shell 脚本调度，重点通常在：

- 命令写死
- 流程固定
- 异常靠脚本作者预判

但 Hermes 的 cron job 不是把命令序列提前写死，而是给 agent 一个目标，让它在当下自行决定：

- 是否需要调用工具
- 用什么顺序推进
- 碰到异常如何调整策略
- 最终如何总结并交付结果

所以它不只是 automation，而是 scheduled agency。

---

## 2. fresh agent 为什么是这个设计的核心，而不是一个实现细节

如果 cron 任务复用用户当前对话 session，会发生很多污染：

- 白天聊到一半的上下文混入夜间自动任务
- 自动任务执行细节反过来挤占人工对话上下文
- 定时作业之间互相泄漏历史

Hermes 选择 fresh `AIAgent`，不是因为这样“比较方便”，而是因为它在明确一件事：

> 每次 cron 触发都是一段新的工作流，不是旧对话的自然延续。

这和 gateway 中的 session routing 是同一个架构思想：

- 不同来源事件，应当有清晰的上下文边界

---

## 3. 为什么 `skill_attachment` 让 cron 从“脚本”变成“任务执行器”

有了 `skill_attachment` 之后，cron job 就不只是一个 prompt 字符串。

它变成了：

- 一个任务目标
- 加上一份任务域操作指南

这很关键，因为它让 cron job 不只是“要做什么”，还带上了“应该如何做”。

例如：

- 同样是日报任务
- 带 `git-reporter` skill 时，会从提交、变更范围、作者分布等角度组织输出
- 不带 skill 时，agent 只能靠通用能力临场判断

所以 skill attachment 正在把 cron 从“定时提问器”升级成“定时 agent 执行器”。

---

## 4. 为什么 delivery 层让 cron 真正融入 Hermes runtime

如果 cron 结果只能写日志，它还是很像传统后台任务。

但 Hermes 会把结果送回：

- Telegram
- CLI
- 其他平台

这说明 cron 不只是后台执行，而是 Hermes 整体交互系统的一部分。它和 gateway 共用 delivery 层，意味着：

- 实时消息入口可以触发 agent
- 定时调度入口也可以触发 agent
- 两者最终都汇入统一交付能力

这让 cron 不再是边缘模块，而是 runtime 的正式入口之一。

---

## 5. 为什么 cron 和 gateway 应该放在同一张架构图里看

很多系统会把 cron 看成附属功能，把 gateway 看成主系统。

但在 Hermes 里，它们其实更像并列入口：

| 入口类型 | 触发方式 | 典型来源 |
|---|---|---|
| Gateway | 外部实时消息 | Telegram / Discord / CLI |
| Cron | 时间触发 | scheduler tick |

它们最终都会：

- 生成任务上下文
- 创建或选择 agent 会话边界
- 进入 agent loop
- 走 delivery 层输出结果

从这个角度看，cron 更像一种 event source，而不只是定时器。

---

## 6. 一个很好用的判断法：你的 cron 是在调度命令，还是在调度一次 agent 决策过程

如果你在设计某个自动任务时，可以先问：

### 如果你调度的是命令

- 步骤已知
- 顺序固定
- 几乎不需要临场决策

那它更像传统 cron script。

### 如果你调度的是 agent 决策过程

- 只给目标，不预写完整过程
- 允许工具调用与动态分支
- 结果还要经由平台回送

那它更像 Hermes 式 agentic cron。

这个问题能很快区分“脚本自动化”和“agent 自动化”。

---

## 7. 为什么这页和 subagent / provider runtime 也有关系

一旦你把 cron 看成 agent 入口，就会发现它天然会和后面几章勾连：

- 可能用到 subagent delegation 拆子任务
- 可能触发 provider fallback 和错误恢复
- 可能依赖 skill 注入提升任务执行质量

这说明 cron 并不是一个封闭子系统，而是：

**把 Hermes 的大部分 runtime 能力，在“时间驱动”场景下重新调用了一遍。**

---

## 8. 和主线章节怎么连起来

这页 bridge doc 最适合这样串读：

- `h12`：理解实时事件怎样进入 agent
- `h13`：理解 scheduler 如何按时触发任务
- 这页：看清 cron 在 Hermes 里其实是另一种 agent 入口，而不是普通后台脚本
- `h15`：继续看到自动任务内部也可能再拆子 agent

这样你对 cron 的理解就会从“定时执行”升级成“定时触发一次完整 agent workflow”。

---

## 9. 这页最该带走的一句话

Hermes 的 cron 不是在定时执行一串预写好的命令，而是在定时触发一次完整、可调用工具、可使用 skill、可回送结果的 agent 执行过程。

这就是为什么它更像 agent trigger，而不是脚本调度器。
