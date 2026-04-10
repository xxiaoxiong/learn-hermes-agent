# Glossary（术语表）

> 这份术语表只收录 `learn-hermes-agent` 主线里最常出现、也最容易混淆的词。  
> 如果你读到某个词时感觉“好像懂，但又说不清它在系统里到底属于哪一层”，先回这里校准。

---

## 推荐联读顺序

如果你已经不是单纯查词，而是开始分不清“这些词分别活在哪一层、和哪些结构绑定”，建议这样一起看：

- 先看 [`h00-architecture-overview.md`](./h00-architecture-overview.md)：建立 19 章全景图。
- 再看 [`data-structures.md`](./data-structures.md)：把这些词对应到真正落地的数据结构。
- 如果你卡在“memory 和 session 到底有什么边界”，回看 `h06` 与 `h07`。
- 如果你卡在“skill、plugin、MCP 都像扩展机制”，回看 `h08`、`h17`、`h18`。

---

## Agent

在本项目里，`agent` 指的是：

**一个会根据上下文做判断，并在需要时调用工具来推进任务的模型执行体。**

你可以把它拆成两部分理解：

- 模型负责推理、规划和决定下一步动作
- 代码负责提供运行环境、工具、权限和状态管理

换句话说，模型不是整个 agent；模型只是 agent 的“大脑”。

---

## Agent Loop

`agent loop` 是整个系统最核心的闭环：

1. 读取当前 `messages`
2. 组装 prompt
3. 调用模型
4. 判断模型是直接回答还是请求工具
5. 如果请求工具，就执行工具并把结果写回上下文
6. 继续下一轮，直到模型停止

没有 loop，就只有“一问一答”；有了 loop，才有真正能连续工作的 agent。

---

## Message / Messages

`message` 是一条消息；`messages` 是消息列表。

它通常包含：

- 用户输入
- assistant 输出
- tool result
- 某些实现里还会包含结构化的工具调用块

`messages` 不是数据库，不是长期记忆；它是**当前工作回合最重要的临时上下文容器**。

---

## Tool

`tool` 是模型可以请求代码执行的一种动作。

例如：

- 读文件
- 写文件
- 搜索文本
- 跑 shell 命令
- 调用外部服务

模型本身并不会直接执行操作系统命令。模型只会说：

- 要调哪个工具
- 工具参数是什么

真正执行动作的是注册在代码里的 handler。

---

## Tool Schema

`tool schema` 是给模型看的“工具说明书”。

它至少要说明：

- 工具名
- 工具用途
- 输入参数
- 参数类型和约束

Hermes 风格里，schema 和 handler 分离，是因为：

- 模型需要理解“这个工具怎么用”
- 代码需要知道“这个工具怎么执行”

这两个问题不是同一个层面。

---

## Tool Registry

`ToolRegistry` 是工具注册表。

它维护的通常是一张映射关系：

- `tool name` → `handler`
- `tool name` → `schema`

这样主循环只负责：

- 收集工具定义给模型
- 根据名字 dispatch 到对应实现

主循环本身不需要知道每个工具的细节。

---

## Agent-level Tool

`agent-level tool` 指那些**不走普通 registry dispatch 路径，而是在主循环里优先被拦截处理**的工具。

在本项目的教学里，最典型的是：

- `todo`

因为它改的不是外部世界，而是 agent 自己的执行状态。

这个概念对理解 `h03` 很关键：

- 普通 tool 改外部环境
- agent-level tool 改 agent 内部状态

---

## Plan / Todo

`plan` 是任务分解后的执行结构；`todo` 是 plan 里的单个步骤。

一个 `todo` 一般有：

- id
- 描述
- 状态（`pending` / `in_progress` / `completed`）

它的价值不是“列个清单好看”，而是让 agent 对自己的进度有最基本的内省能力。

---

## Prompt Assembly

`prompt assembly` 指 system prompt 不是一段写死的大字符串，而是**由多个 section 在运行时拼装**。

Hermes 风格里，常见 section 来源包括：

- personality / role
- memory
- skills
- context files
- tool guidance

这让 prompt 能随着状态变化而变化，同时又保留可维护的结构边界。

---

## System Prompt

`system prompt` 是系统级指令层。

它的职责通常包括：

- 规定 agent 的行为边界
- 告诉模型有哪些协作规则
- 给出工具使用原则
- 约束输出风格与安全策略

在 Hermes 的教学上下文里，一个重点是：

**system prompt 负责稳定的高优先级规则，skill 则更像临时操作指南。**

---

## Skill

`skill` 是一份可被注入给 agent 的操作指南。

它通常不是在定义人格，而是在定义：

- 某类任务怎么做
- 需要遵循什么步骤
- 遇到什么场景该注意什么

在 Hermes 里，skill 以 `user message` 而不是 `system prompt` 注入，关键目的是：

- 不破坏 system prompt 的稳定性
- 提高 prompt cache 的命中率

---

## Memory

`memory` 指跨会话保留的信息。

它和普通上下文最大的区别是：

- 上下文只在当前会话里临时存在
- memory 设计成可跨会话延续

适合写进 memory 的内容通常是：

- 用户长期偏好
- 多次重复出现的重要事实
- 对未来任务仍然有持续价值的信息

不是什么都该记住。

---

## Session

`session` 是一次连续工作过程的会话单元。

它一般对应：

- 一组连续的 `messages`
- 一个可恢复的上下文状态
- 一个可持久化保存到数据库的记录

在 `h06` 里，session 的重点不是“聊天记录”，而是：

**它让 agent 可以中断后恢复，也让过去的历史可检索。**

---

## Lineage

`lineage` 是 session 之间的谱系关系。

它尤其在上下文压缩时重要：

- 压缩后可能会产生新的 session
- 新 session 会记录 parent session
- 这样即使当前窗口被压缩，系统仍然能追溯到更早的完整历史

lineage 的价值不是显示在 UI 上，而是保证状态可追踪。

---

## Context Compression

`context compression` 是在上下文变长后，对历史进行压缩整理的机制。

正确理解它有两个要点：

- 它不是简单删除旧消息
- 它的目标是保住近期工作记忆，同时把较早历史折叠成摘要

Hermes 风格强调的是：

- 保留最新 N 条
- 压缩中间层历史
- 保持 tool call / tool result 的配对完整

---

## Approval / Permission

`approval` 或 `permission` 指工具执行前的安全判断层。

它要解决的问题不是“工具能不能写出来”，而是：

- 这次调用是否危险
- 是否能自动允许
- 是否必须询问用户
- 是否应该直接拒绝

Hermes 的重要设计点是：

**安全门放在调度层统一处理，而不是每个工具各自实现一套。**

---

## Danger Pattern

`DangerPattern` 是权限系统里用于识别高风险操作的一类匹配规则。

它常用于检测：

- 危险 shell 命令
- 敏感路径操作
- 高风险写入行为

它不是完整的安全系统，但它是统一拦截链路里的第一层信号源。

---

## Fallback Provider

`fallback provider` 是模型调用失败后的备用后端。

它处理的不是业务语义，而是运行时可用性问题，例如：

- 主 provider 限流
- 服务端错误
- 某个模型当前不可用

其核心思想是：

**模型调用失败，不等于任务失败。**

---

## Gateway

`gateway` 是多平台接入层。

它的职责是把不同平台的输入输出统一成 Hermes 内部能理解的格式。

例如：

- Telegram 消息
- Discord 消息
- Slack 事件

这些平台差异不应该污染 `AIAgent` 主逻辑，所以它们被收敛在 gateway 层。

---

## Hook

`hook` 是生命周期里的一个可插入观察点。

它允许你：

- 在工具调用前后做附加逻辑
- 记录日志
- 注入审计信息
- 追加监控行为

但 hook 的边界也要看清：

**它适合做副作用，不适合改写主循环控制流。**

---

## Subagent

`subagent` 是为子任务派生出来的 agent 执行单元。

它最重要的价值不是“多一次模型调用”，而是：

- 给子任务一块更干净的工作上下文
- 降低父任务上下文被污染的风险
- 让复杂目标可以按子任务拆分

理解 `h15` 时，最要避免的误区就是把 subagent 只看成“递归调用模型”。

---

## Provider Runtime

`provider runtime` 是模型后端适配层。

它负责把：

- provider 名称
- model 名称
- api mode
- key / base_url

这些配置解析成真正可执行的调用方案。

它的价值在于让上层 agent 尽量对模型供应商无感。

---

## MCP

`MCP`（Model Context Protocol）可以先粗略理解为：

**让外部能力以标准协议接进 agent 的一种方式。**

在 Hermes 的教学里，MCP 最关键的不是“外部工具”这四个字，而是：

- 它也会被注册成 tool
- 最终仍然进入统一 dispatch 路径
- 对 agent 来说，它和原生工具尽量表现一致

---

## Plugin

`plugin` 是官方扩展接口。

它和 skill 的边界一定要分清：

- `skill` 注入的是操作指南
- `plugin` 注册的是能力本身，例如工具、hook、命令

所以 plugin 更接近“扩展代码能力”，skill 更接近“补充任务方法”。

---

## Trajectory

`trajectory` 指一次 agent 运行留下的结构化轨迹数据。

它可能包含：

- 输入
- 中间消息
- 工具调用
- 输出
- 成败标签

在 `h19` 里，它的意义是：

**每次运行都有机会变成训练数据，但前提是先过滤、清洗、格式化。**

---

## 最后怎么用这份术语表

如果你后面继续读章节，建议把这份术语表当成一个“纠偏页”来用：

- 看不懂词，就回这里
- 分不清词属于哪层，就回 `h00`
- 分不清词最后落成什么结构，就回 `data-structures.md`

术语表的目标不是让你背定义，而是帮你在阅读过程中**始终守住边界感**。
