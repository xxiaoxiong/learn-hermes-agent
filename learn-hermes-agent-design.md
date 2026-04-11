# Learn Hermes Agent — 完整设计文档与任务清单

**日期**: 2026-04-10  
**版本**: v2（深度复查修订）  
**状态**: 待用户审核  
**参考项目**: `learn-claude-code/` (结构蓝本), `hermes-agent/` (内容来源)

### 已确认决策

| 决策点 | 结论 |
|---|---|
| 实现方式 | 方案 C：h01-h06 教学 Python + h07-h19 真实源码片段 |
| SDK | OpenAI SDK 兼容接口，通过 `.env` 配置模型/密钥/base_url |
| 语言 | zh（主）+ en（次），不支持 ja |
| 部署 | Vercel 静态托管 + 本地 `npm run dev` / `npm run build` 均支持 |
| 整合版 | 不需要 `h_full.py`（不做完整 Hermes 简化实现） |

---

## 一、项目概览

### 1.1 目标

以 `learn-claude-code` 的教学框架为蓝本，为 Hermes Agent 构建一个**可交互的 Web 学习平台**，帮助开发者系统理解 Hermes Agent 的核心机制与架构。

### 1.2 核心理念

- **模型负责思考，代码负责提供工作环境**（继承 learn-claude-code 的核心主张）
- 前 5 章提供"从零到一"的**简化教学 Python 实现**，让读者能自己写出 Hermes 核心机制
- 后 12 章直接**解读 Hermes 实际源码**，配合 Web 平台的可视化注解

### 1.3 项目位置

```
e:\@@MyStudyFiles\AI\Github上项目\
├── hermes-agent/          ← 原始项目（只读引用）
├── learn-claude-code/     ← 结构蓝本
└── learn-hermes-agent/    ← 本项目（新建）
```

### 1.4 语言支持

- **zh**（中文，主线，优先完成）
- **en**（英文，次要，核心章节同步）

---

## 二、整体架构

### 2.1 目录结构

```
learn-hermes-agent/
├── agents/                    # h01-h06  Python 实现（OpenAI SDK）
│   ├── config.py              # 共享 .env 配置（BASE_URL / API_KEY / MODEL）
│   ├── h01_agent_loop.py
│   ├── h02_tool_system.py
│   ├── h03_planning_todos.py
│   ├── h04_prompt_assembly.py
│   ├── h05_context_compression.py
│   └── h06_session_storage.py
├── docs/
│   ├── zh/                    # 中文主线文档（h00~h17 + bridge docs）
│   └── en/                    # 英文文档（核心章节同步）
├── web/                       # Next.js 教学 Web 平台
│   ├── src/
│   │   ├── app/[locale]/      # 国际化路由
│   │   ├── components/        # 复用自 learn-claude-code
│   │   ├── data/generated/    # 由 extract-content.ts 生成
│   │   ├── lib/               # constants, version-content, i18n 等
│   │   └── types/
│   └── scripts/
│       └── extract-content.ts # 从 agents/ + docs/ 提取数据
├── snippets/                  # h07-h19 精选 Hermes 源码片段（含行号注释，100-300行）
│   ├── h07_memory_system.py
│   ├── h08_skills_system.py
│   └── ... h19_rl_trajectories.py
├── skills/                    # h08 Skills 章节示例文件
├── .env.example
├── requirements.txt
├── README.md
└── README-zh.md
```

### 2.2 Web 平台页面路由

| 路由 | 功能 |
|---|---|
| `/[locale]` | 首页：章节列表（按 4 层组织） |
| `/[locale]/[version]` | 单章页：Learn / Code / Deep Dive 三标签 |
| `/[locale]/timeline` | 时间线视图：19 章顺序展开 |
| `/[locale]/layers` | 分层视图：4 层边界与递进关系 |
| `/[locale]/compare` | 对比视图：相邻章节差异诊断 |
| `/[locale]/docs/[slug]` | Bridge 文档（深度补充） |
| `/[locale]/reference` | 参考：完整源码与模块映射 |

### 2.3 单章页三标签结构

```
[Learn]     — 对应 docs/zh/h0X-*.md 渲染的 Markdown 文档
[Code]      — h01-h06: agents/h0X_*.py 全文源码查看器
              h07-h19: snippets/h0X_*.py 精选源码片段（含注解）
[Deep Dive] — 架构图 + 执行流 + 模拟器 + 对比差异 + 学习指引卡片
```

> **h07-h19 代码层说明**：不直接解析 `hermes-agent/` 的巨型文件（单文件 9000+ 行），而是在 `snippets/` 目录下为每章准备**精选片段文件**（100-300 行），每段保留原始行号注释，供 `extract-content.ts` 抽取。这样既保留真实代码，又控制展示复杂度。

### 2.4 数据流

```
agents/h0X_*.py          (h01-h06 教学实现)
snippets/h0X_*.py        (h07-h19 精选 Hermes 源码片段)
docs/**/*.md             (zh/en 文档)
       ↓
scripts/extract-content.ts
       ↓
src/data/generated/versions.json  (章节元数据 + 源码)
src/data/generated/docs.json      (文档内容)
       ↓
Next.js 构建 → 静态页面
```

---

## 三、章节结构（19 章 · 4 层）

> **设计原则**：每章只引入**一个**新概念（`coreAddition`），并提炼**一句**核心洞察（`keyInsight`）。这是 learn-claude-code 教学效果好的根本原因。

### Layer 1: Core Single-Agent（h01–h06）

> 一个 agent 能做到什么**最低限度**。本层全部提供**简化教学 Python 实现**（OpenAI SDK）。

| ID | 标题 | Core Addition | Key Insight | 对应源文件 |
|---|---|---|---|---|
| h01 | Agent Loop | message 列表 + API 调用 + stop 条件 | Agent 是一个循环：发消息 → 执行工具 → 回流结果 → 重复。没有循环就没有 agent。 | `run_agent.py` |
| h02 | Tool System | ToolRegistry + dispatch map + schema 收集 | 添加一个工具只需注册一次。主循环永远不变。 | `tools/registry.py`, `model_tools.py` |
| h03 | Planning & Todos | todo 工具在 registry **之前**拦截 + step tracking | 任务追踪是 agent 对自身进度的唯一内省手段。 | `run_agent.py` (agent-level tools) |
| h04 | Prompt Assembly | PromptBuilder + 5 类 section + 组装顺序 | system prompt 不是字符串，是一个有优先级的截面集合。 | `agent/prompt_builder.py` |
| h05 | Context Compression | CompressionPolicy + preflight 检查 + lineage ID | 压缩不是截断——保住最新 N 条，摘要中间，生成新谱系节点。 | `agent/context_compressor.py` |
| h06 | Session Storage | SQLite sessions + FTS5 全文搜索 + lineage 追踪 | session 谱系链让 agent 在压缩后仍能检索到完整历史。 | `hermes_state.py` |

### Layer 2: Production Hardening（h07–h11）

> 一个 agent 如何**可靠工作**。本层以真实 Hermes 源码为主，辅以精选片段注解。

| ID | 标题 | Core Addition | Key Insight | 对应源文件 |
|---|---|---|---|---|
| h07 | Memory System | MEMORY.md / USER.md flush + memory_manager 去重 | 上下文里的知识随压缩丢失；写入 MEMORY.md 才是真正记住。 | `agent/memory_manager.py`, `tools/memory_tool.py` |
| h08 | Skills System | skill 文件格式 + discovery + 注入为 user message | skill 用 user message 注入而非 system prompt，是为了不破坏 prompt cache。 | `agent/skill_commands.py`, `skills/` |
| h09 | Approval & Permission | DangerPattern 检测 + approval_callback + allowlist | 安全门在调度层统一拦截，不在工具内部各自为政。 | `tools/approval.py` |
| h10 | Error Recovery | retry + fallback provider 链 + continuation reason | 大多数失败不是任务失败——它们是"换条路试试"的信号。 | `run_agent.py` (fallback logic) |
| h11 | CLI Architecture | COMMAND_REGISTRY + slash 路由 + 多端派生 | slash command 的本质是命令路由，而不是 if-else 链。 | `cli.py`, `hermes_cli/commands.py` |

### Layer 3: Multi-Platform Runtime（h12–h15）

> 一个 agent 如何**服务多个平台**并管理跨平台任务。

| ID | 标题 | Core Addition | Key Insight | 对应源文件 |
|---|---|---|---|---|
| h12 | Gateway System | GatewayRunner + platform adapter 接口 + session routing | 平台差异只在入口层，AIAgent 内部对平台无感。 | `gateway/run.py`, `gateway/platforms/` |
| h13 | Cron Scheduler | CronJob + skill attachment + 平台 delivery | cron job 不是 shell 任务——是带完整 agent 能力的定时任务。 | `cron/jobs.py`, `cron/scheduler.py` |
| h14 | Hook System | HookEvent lifecycle + builtin_hooks + plugin hook 接口 | hook 让你在不修改主循环的前提下改变 agent 行为。 | `gateway/hooks.py`, `hermes_cli/plugins.py` |
| h15 | Subagent Delegation | delegate_tool + IterationBudget 共享 + 上下文隔离 | 子 agent 的价值不是多一次模型调用，是给子任务一个干净的上下文。 | `tools/delegate_tool.py` |

### Layer 4: Advanced Platform（h16–h19）

> 一个 agent 如何成为**可扩展平台**——支持任意模型、外部工具、插件和训练数据生成。

| ID | 标题 | Core Addition | Key Insight | 对应源文件 |
|---|---|---|---|---|
| h16 | Provider Runtime | 3 API modes + CredentialPool + fallback chain | provider 抽象层让模型切换对 AIAgent 完全透明。 | `hermes_cli/runtime_provider.py`, `hermes_cli/auth.py` |
| h17 | MCP Integration | MCPServer + 动态工具发现 + capability routing | MCP 工具和原生工具共用同一注册表——agent 看不出区别。 | `tools/mcp_tool.py` |
| h18 | Plugin System | PluginContext API + 3 discovery sources + memory provider | 扩展 Hermes 不需要 fork——插件接口是一等公民。 | `hermes_cli/plugins.py`, `plugins/memory/` |
| h19 | RL & Trajectories | BatchRunner + trajectory 格式 + Atropos env | 每一次 agent 运行都是潜在的训练数据——关键是如何过滤和格式化。 | `batch_runner.py`, `environments/` |

---

## 四、全项目任务清单（总览）

### Phase 0: 项目脚手架

- [x] 创建 `learn-hermes-agent/` 目录结构（含 `agents/`, `snippets/`, `docs/zh/`, `docs/en/`, `web/`, `skills/`）
- [x] 初始化 `requirements.txt`（openai, python-dotenv, sqlite3 stdlib）
- [x] 创建 `agents/config.py`（读取 `HERMES_BASE_URL` / `HERMES_API_KEY` / `HERMES_MODEL`）
- [ ] 创建 `.env.example`：
  ```
  HERMES_BASE_URL=https://openrouter.ai/api/v1
  HERMES_API_KEY=your_api_key_here
  HERMES_MODEL=anthropic/claude-3-5-sonnet-20241022
  ```
- [x] 编写 `README-zh.md`（中文，主线）
- [x] 编写 `README.md`（英文）
- [x] 初始化 `web/` Next.js 项目（基于 learn-claude-code/web 适配）
- [x] 配置 TailwindCSS、shadcn/ui、next-intl（zh/en 双语）
- [x] 创建 `web/vercel.json` + `web/.env.example`
- [x] 验证本地 `npm run dev` 和 `npm run build` 均可用

### Phase 1: Web 平台基础框架

- [x] 适配 `web/src/types/agent-data.ts`（类型定义内联在 constants.ts 中，已覆盖）
- [x] 编写 `web/src/lib/constants.ts`：
  - `VERSION_ORDER`（h01-h19）
  - `VERSION_META`（每章 title / subtitle / coreAddition / keyInsight / layer / prevVersion）
  - `LAYERS`（4层：core / hardening / runtime / platform，含颜色和版本列表）
- [x] 编写 `web/src/lib/version-content.ts`（内容集成在 constants.ts + source-loader.ts 中）
- [x] 编写 `web/src/lib/chapter-guides.ts`（每章 focus / confusion / goal，zh/en 双语，共 19 × 2 = 38 条目）
- [x] 编写 `web/src/lib/i18n.tsx` + `i18n-server.ts`（zh/en）
- [x] 搭建 `web/src/app/[locale]/` 路由框架（App Router）
- [x] 完成首页 `page.tsx`（章节列表 + 层分组 + 搜索入口）
- [x] 完成单章页 `[version]/page.tsx`（shiki 代码高亮 + marked 文档渲染）+ `client.tsx`（三标签：Learn / Code / Deep Dive）
- [x] 添加左侧章节导航侧边栏 `ChapterSidebar`（按 4 层分组，含激活高亮，2 列固定高度布局）
- [x] 完成 Timeline 页（19 章顺序 + 层分隔可视化）
- [x] 完成 Layers 页（4 层边界说明 + 层内章节卡片）
- [x] 完成 Compare 页（任意两章 diff：新增类/函数/概念）
- [x] 完成 Docs 页（Bridge 文档渲染）
- [x] 编写 `scripts/extract-content.ts`（适配 h01-h19 命名，支持 agents/ + snippets/ 两个来源）

### Phase 2: 教学 Python 实现（h01–h06）

> 所有文件均通过 `agents/config.py` 读取 `.env` 配置。每个文件可独立运行。

- [x] `agents/config.py` — 共享 OpenAI client 初始化（BASE_URL / API_KEY / MODEL）
- [x] `agents/h01_agent_loop.py` — 最小 agent 循环（仅 bash 工具，无其他依赖）
- [x] `agents/h02_tool_system.py` — ToolRegistry + 3 个示例工具
- [x] `agents/h03_planning_todos.py` — todo 工具拦截模式 + step tracking
- [x] `agents/h04_prompt_assembly.py` — PromptBuilder（5 类 section）
- [x] `agents/h05_context_compression.py` — CompressionPolicy + summary + lineage
- [x] `agents/h06_session_storage.py` — SessionDB（SQLite + FTS5 + lineage）
- [x] 验证：每个文件 `python agents/h0X_*.py` 均可独立运行

### Phase 3: 精选源码片段（snippets/）

> 每个文件从 hermes-agent/ 手工抽取 100-300 行，保留原始行号注释。

- [x] `snippets/h07_memory_system.py`
- [x] `snippets/h08_skills_system.py`
- [x] `snippets/h09_approval_permission.py`
- [x] `snippets/h10_error_recovery.py`
- [x] `snippets/h11_cli_architecture.py`
- [x] `snippets/h12_gateway_system.py`（实际文件名：h12_gateway.py）
- [x] `snippets/h13_cron_scheduler.py`
- [x] `snippets/h14_hook_system.py`（实际文件名：h14_hooks_system.py）
- [x] `snippets/h15_subagent_delegation.py`（实际文件名：h15_subagent.py）
- [x] `snippets/h16_provider_runtime.py`
- [x] `snippets/h17_mcp_integration.py`（实际文件名：h17_mcp_protocol.py）
- [x] `snippets/h18_plugin_system.py`
- [x] `snippets/h19_rl_trajectories.py`（实际文件名：h19_rl_training.py）

### Phase 4: 中文文档（docs/zh/）

> `h00-architecture-overview.md` 必须最先写，是所有后续章节的地图。
> 章节 bridge doc 一旦完成，必须同步确保 `web/src/lib/bridge-docs.ts` 与 `npm run extract` 生成结果可见。

- [x] `h00-architecture-overview.md`（Hermes 全景图：组件、数据流、文件依赖链）
- [x] `h01-agent-loop.md`
- [x] `h02-tool-system.md`
- [x] `h03-planning-todos.md`
- [x] `h04-prompt-assembly.md`
- [x] `h05-context-compression.md`
- [x] `h06-session-storage.md`
- [x] `h07-memory-system.md`
- [x] `h08-skills-system.md`
- [x] `h09-approval-permission.md`
- [x] `h10-error-recovery.md`
- [x] `h11-cli-architecture.md`
- [x] `h12-gateway-system.md`
- [x] `h13-cron-scheduler.md`
- [x] `h14-hook-system.md`
- [x] `h15-subagent-delegation.md`
- [x] `h16-provider-runtime.md`
- [x] `h17-mcp-integration.md`
- [x] `h18-plugin-system.md`
- [x] `h19-rl-trajectories.md`
- [ ] `glossary.md`（术语表）
- [ ] `data-structures.md`（核心数据结构速查）
+ [x] `glossary.md`（术语表）
+ [x] `data-structures.md`（核心数据结构速查）
+ [x] Bridge docs（已覆盖：h03a、h04a、h05a、h06a、h07a、h08a、h09a、h10a、h11a、h12a、h13a、h14a、h15a、h16a、h17a、h18a、h19a）

### Phase 5: 英文文档（docs/en/）

- [ ] `h00-architecture-overview.md`
- [ ] `h01-agent-loop.md` ~ `h06-session-storage.md`（
- [ ] `h07-h19`

### Phase 6: Web 平台可视化组件数据

- [ ] `src/data/architecture-blueprints.ts`（每章架构图节点/边数据，Hermes 版）
- [x] `src/data/execution-flows.ts`（每章执行流步骤，Hermes 版）
- [ ] `src/lib/bridge-docs.ts`（Bridge 文档元数据：kind, summary, linked chapters）
+ [x] `src/lib/bridge-docs.ts`（Bridge 文档元数据：kind, summary, linked chapters，且已接入文档详情页/章节详情页关联跳转）
- [x] `src/lib/design-decisions.ts`（每章设计决策说明）

### Phase 7: 生成数据 & 验收

- [ ] 运行 `npm run extract` 生成 `src/data/generated/versions.json` 和 `docs.json`
+ [x] 运行 `npm run extract` 生成 `src/data/generated/versions.json` 和 `docs.json`
- [ ] 本地 `npm run dev` 跑通，逐章点击验收（19 章 × 3 标签 = 57 视图）
- [ ] `npm run build` 验收静态生成，无 404
- [ ] 部署 Vercel，验证预览 URL
- [ ] 补充 `.gitignore`（`node_modules/`, `.next/`, `src/data/generated/`）

---

## 五、各模块详细任务清单

---

### h01 — Agent Loop（教学实现）

**核心问题**: Hermes 的 agent 循环和 OpenAI 的简单 chat 有什么本质区别？

**关键数据结构**:
- `messages: list[dict]` — 对话历史（OpenAI 格式）
- `LoopState` — 当前迭代数、预算剩余、是否被中断
- `ToolCall` — tool_call_id, name, arguments

**教学实现任务**:
- [ ] 实现最小 `AIAgent` 类，包含 `run_conversation(user_message)` 方法
- [ ] 实现 while 循环：API 调用 → tool_calls 判断 → 执行 → 回流结果
- [ ] 实现 `tool_result` 消息格式（role: "tool"）
- [ ] 实现 iteration budget 上限保护
- [ ] 实现两种退出路径：正常回答 vs 到达 max_iterations
- [ ] 不引入任何外部依赖（仅 `openai` SDK）

**文档任务 (docs/zh/h01-agent-loop.md)**:
- [ ] 问题：没有循环 agent 会怎样（只输出不执行）
- [ ] 概念：tool_use → tool_result 的闭环是什么
- [ ] 最小实现讲解
- [ ] 关键数据结构图解
- [ ] 与 Hermes 真实 `run_agent.py` 的对应关系

**Deep Dive 组件**:
- [ ] 架构图：messages 流动的闭环
- [ ] 执行流：turn lifecycle（6 步序列图）
- [ ] 学习卡片：focus / confusion / goal

---

### h02 — Tool System（教学实现）

**核心问题**: 如何让 agent 可以"无限扩展"工具而不改主循环？

**关键数据结构**:
- `ToolSchema` — name, description, parameters (JSON Schema)
- `ToolRegistry` — `{name: handler}` dispatch map
- `ToolResult` — success/error + content string

**教学实现任务**:
- [ ] 实现 `ToolRegistry` 类：`register(name, schema, handler)` + `dispatch(name, args)`
- [ ] 实现 3 个示例工具：`read_file`, `write_file`, `run_command`
- [ ] 实现工具 schema 自动收集（供 API 调用时传入 tools 参数）
- [ ] 实现工具执行错误包装（不让工具异常打断主循环）
- [ ] 演示：添加一个新工具只需 3 行注册代码

**文档任务**:
- [ ] 问题：工具注册为什么要与执行解耦
- [ ] 概念：schema vs handler 的分离
- [ ] Hermes 中 `registry.register()` 的自注册模式讲解
- [ ] 工具添加教程（对标 AGENTS.md 的 Adding New Tools）

---

### h03 — Planning & Todos（教学实现）

**核心问题**: agent 怎么追踪自己做到哪一步了？

**关键概念**:
- **Agent-level tool 拦截**：`todo` 工具在 ToolRegistry dispatch **之前**被 `run_agent.py` 拦截处理
- `TodoItem` — id, description, status (pending / in_progress / done)
- `PlanState` — 当前活跃 todo 列表，存在 agent 实例属性上而非数据库

**教学实现任务**:
- [ ] 在 `run_conversation()` 里添加 agent-level tool 拦截逻辑（先检查是否为 todo，再走 registry）
- [ ] 实现 `todo` 工具的 4 个操作：`create`, `update`, `complete`, `list`
- [ ] 实现 PlanState 在循环中持久化（不随 messages 压缩丢失）
- [ ] 演示：给 agent 一个多步骤任务，观察它自动创建和更新 todo

**文档任务 (docs/zh/h03-planning-todos.md)**:
- [ ] 问题：没有 todo 时 agent 处理复杂任务会怎样（容易迷路）
- [ ] 概念：agent-level tool vs registry tool 的拦截机制差异
- [ ] 讲解 Hermes `run_agent.py` 中 `todo` 工具的实际拦截位置（行号引用）
- [ ] Bridge doc: `h03a-agent-level-tools.md`（session_search, memory 也是 agent-level tool）
+ [x] Bridge doc: `h03a-agent-level-tools.md`（session_search, memory 也是 agent-level tool）

---

### h04 — Prompt Assembly（教学实现）

**核心问题**: system prompt 为什么不该是一个写死的字符串？

**关键数据结构**:
- `PromptSection` — name, content, priority, condition
- `SystemPrompt` — 按优先级顺序组装的 section 列表
- 5 层来源：personality / memory / skills / context_files / tool_guidance

**教学实现任务**:
- [ ] 实现 `PromptBuilder` 类：`add_section(name, content, condition=None)` + `build() -> str`
- [ ] 实现 5 类 section 的最小读取逻辑（从文件/列表读取）
- [ ] 实现 condition 控制（文件不存在则跳过该 section）
- [ ] 演示：关闭 SOUL.md 时 prompt 如何变化

**文档任务 (docs/zh/h04-prompt-assembly.md)**:
- [ ] 讲解 Hermes `prompt_builder.py` 的 5 层结构与组装顺序
- [ ] 为什么 prompt 稳定性对 Anthropic prompt caching 至关重要
- [ ] Bridge doc: `h04a-prompt-caching.md`（cache breakpoint 机制）
+ [x] Bridge doc: `h04a-prompt-caching.md`（cache breakpoint 机制）

---

### h05 — Context Compression（教学实现）

**核心问题**: 上下文越跑越长怎么办？

**关键数据结构**:
- `CompressionPolicy` — threshold (%), protect_last_n
- `SummaryBlock` — compressed_turn_ids, summary_text
- `lineage_id` — 压缩后新 session 的 parent_session_id

**教学实现任务**:
- [ ] 实现 `ContextCompressor` 类
- [ ] 实现 token 估算（简化版：按字符数估算，无需 tiktoken）
- [ ] 实现 preflight 检查：超 50% 触发压缩
- [ ] 实现 middle turns 摘要（调用同一 LLM 生成 summary）
- [ ] 实现 `protect_last_n` 保留最新 N 条消息不压缩
- [ ] 实现 tool call/result pair 不拆分原则（成对保留）
- [ ] 演示压缩前后的消息数变化

**文档任务 (docs/zh/h05-context-compression.md)**:
- [ ] 问题：context overflow 的实际症状（截断 vs 报错）
- [ ] Hermes 的两种触发时机（preflight 50% vs gateway auto 85%）
- [ ] Bridge doc: `h05a-lineage-model.md`（session 谱系与压缩的关系）
+ [x] Bridge doc: `h05a-lineage-model.md`（session 谱系与压缩的关系）

---

### h06 — Session Storage（教学实现）

**核心问题**: 会话历史怎么持久化，下次还能恢复？

**关键数据结构**:
- `SessionRecord` — session_id, platform, messages (JSON), created_at
- FTS5 虚拟表 — 全文搜索索引
- `parent_session_id` — 压缩谱系追踪

**教学实现任务**:
- [ ] 实现 `SessionDB` 类（SQLite, in-memory or file）
- [ ] 实现 `save_session(session_id, messages)` 和 `load_session(session_id)`
- [ ] 实现 FTS5 虚拟表和 `search(query) -> list[SessionRecord]`
- [ ] 实现 session lineage tracking（压缩后记录 parent_id）
- [ ] 实现多平台隔离（platform 字段过滤查询）
- [ ] 演示：保存会话 → 搜索 → 加载继续

**文档任务 (docs/zh/h06-session-storage.md)**:
- [ ] 讲解 Hermes `hermes_state.py` 完整 schema
- [ ] FTS5 全文搜索原理与用途（`/search` 命令背后的机制）
- [ ] Bridge doc: `h06a-session-search.md`（session_search 作为 agent-level tool）
+ [x] Bridge doc: `h06a-session-search.md`（session_search 作为 agent-level tool）

---

### h07 — Memory System（真实源码）

**核心问题**: 什么信息值得跨会话保存？

**Source**: `snippets/h07_memory_system.py`（来自 `agent/memory_manager.py`, `tools/memory_tool.py`）

**教学任务**:
- [ ] 文档讲解 `MEMORY.md` / `USER.md` 的结构约束（字符上限、分类原则）
- [ ] 讲解 memory flush 时机：在 turn 结束前、压缩前强制写入
- [ ] 讲解 `memory_manager.py` 的字符限制与去重逻辑
- [ ] Code 标签页：memory write 核心逻辑（flush + dedup）
- [ ] Deep Dive: 临时上下文 vs 持久记忆的决策树，与 h06 session storage 的边界
- [ ] Deep Dive: 与 learn-claude-code s09 Memory System 的设计对比
- [x] Bridge doc: `h07a-memory-vs-session.md`（session、memory、session_search 的边界）

---

### h08 — Skills System（真实源码）

**核心问题**: 为什么 skill 注入用 user message 而非 system prompt？

**Source**: `snippets/h08_skills_system.py`（来自 `agent/skill_commands.py`, `skills/`）

**教学任务**:
- [ ] 文档讲解 skill 文件格式（YAML frontmatter + markdown body）
- [ ] 讲解 skill discovery：`~/.hermes/skills/` + project `.hermes/skills/` 扫描
- [ ] 讲解 skill 注入时机：用 user message 注入（不破坏 system prompt cache）
- [ ] 讲解 `/skills` slash command + agentskills.io 安装流程
- [ ] Code 标签页：`skill_commands.py` 核心注入逻辑片段
- [ ] skills/ 目录展示 2-3 个示例 skill 文件
- [ ] Deep Dive: skill（操作指南）vs memory（状态记录）的边界
- [x] Bridge doc: `h08a-skill-injection-boundary.md`（skill 与 system prompt / memory / plugin 的边界）

---

### h09 — Approval & Permission（真实源码）

**核心问题**: 如何在不阻塞工作流的前提下拦截危险操作？

**Source**: `snippets/h09_approval_permission.py`（来自 `tools/approval.py`）

**教学任务**:
- [ ] 文档讲解危险模式检测：正则 DangerPattern + allowlist 优先顺序
- [ ] 讲解 `approval_callback` 如何对接 CLI 输入 / Gateway 交互消息
- [ ] 讲解 deny → check_mode → allow → ask 四段 pipeline（对标 learn-claude-code s07）
- [ ] Code 标签页：危险检测 + callback 触发逻辑
- [ ] Deep Dive: 与 learn-claude-code s07 Permission System 的设计对比
- [x] Bridge doc: `h09a-approval-pipeline.md`（权限系统位于调度层）

---

### h10 — Error Recovery（真实源码）

**核心问题**: API 失败了怎么办？什么时候该重试，什么时候该换模型？

**Source**: `snippets/h10_error_recovery.py`（来自 `run_agent.py` fallback logic）

**教学任务**:
- [ ] 文档讲解 3 类错误的不同处理策略：429 rate limit / 5xx server / 401 auth
- [ ] 讲解 `fallback_providers` 链：主模型失败后按序尝试备用
- [ ] 讲解 continuation reason：失败不等于任务失败，重入循环继续
- [ ] 讲解 auxiliary 任务的独立 fallback 链（vision / compression / session search）
- [ ] Code 标签页：fallback 触发 + provider 切换逻辑
- [ ] Deep Dive: 与 learn-claude-code s11 Error Recovery 对比
- [x] Bridge doc: `h10a-fallback-taxonomy.md`（retry / fallback / continuation 的分层）

---

### h11 — CLI Architecture（真实源码）

**核心问题**: slash command 如何从一个中心注册表驱动 CLI / Gateway / Telegram 等多端？

**Source**: `snippets/h11_cli_architecture.py`（来自 `hermes_cli/commands.py`, `cli.py`）

**教学任务**:
- [ ] 文档讲解 `COMMAND_REGISTRY`：CommandDef 的字段结构（name, aliases, handler, help）
- [ ] 讲解 `resolve_command()` 别名解析 + 模糊匹配
- [ ] 讲解 CLI / Gateway / Telegram 三端如何从同一 registry 派生不同的处理路径
- [ ] 讲解 Skin Engine（`skin_engine.py`）数据驱动 TUI 主题
- [ ] Code 标签页：CommandDef 注册 + resolve 核心逻辑
- [ ] Deep Dive: 架构图（COMMAND_REGISTRY 辐射多端）
- [x] Bridge doc: `h11a-command-registry-routing.md`（命令字符串背后真正统一的是命令描述与路由对象）

---

### h12 — Gateway System（真实源码）

**核心问题**: 同一个 AIAgent 如何同时服务 15 个消息平台？

**Source**: `snippets/h12_gateway_system.py`（来自 `gateway/run.py`, `gateway/platforms/`）

**教学任务**:
- [ ] 文档讲解 `GatewayRunner` 架构（long-running process + message dispatch loop）
- [ ] 讲解 platform adapter 接口：`on_message(event) → MessageEvent` 统一格式
- [ ] 讲解 session routing：per-platform + per-user 的 session key 生成
- [ ] 讲解 DM pairing 授权机制（allowlist + pairing code）
- [ ] Code 标签页：`GatewayRunner._handle_message()` 核心分发逻辑
- [ ] Deep Dive: 数据流图（Platform Event → AIAgent → Delivery）
- [x] Bridge doc: `h12a-session-routing.md`（Gateway 的核心是会话边界路由，不是平台接入数量）

---

### h13 — Cron Scheduler（真实源码）

**核心问题**: 如何让 agent 在无人在场时自动执行任务？

**Source**: `snippets/h13_cron_scheduler.py`（来自 `cron/jobs.py`, `cron/scheduler.py`）

**教学任务**:
- [ ] 文档讲解 cron job 数据结构（`jobs.json`：prompt, schedule, skill_attachment, target_platform）
- [ ] 讲解调度触发：scheduler tick → 检查 next_run → 创建 fresh AIAgent → 执行
- [ ] 讲解 skill attachment：cron job 可绑定特定 skill 作为执行上下文
- [ ] 讲解 delivery：结果发送到指定平台（与 Gateway 共用 delivery 层）
- [ ] Code 标签页：scheduler tick + job 执行核心逻辑
- [ ] Deep Dive: 与 learn-claude-code s14 Cron Scheduler 对比
- [x] Bridge doc: `h13a-agentic-cron.md`（cron 是时间驱动的 agent trigger，而不是脚本调度）

---

### h14 — Hook System（真实源码）

**核心问题**: 如何在不修改主循环的前提下扩展 agent 行为？

**Source**: `snippets/h14_hook_system.py`（来自 `gateway/hooks.py`, `hermes_cli/plugins.py`）

**教学任务**:
- [ ] 文档讲解 HookEvent 生命周期列表（pre/post_tool_call, on_message, on_response 等）
- [ ] 讲解 `builtin_hooks/`：始终注册的内置钩子（不依赖插件）
- [ ] 讲解 plugin hook 注册：`PluginContext.register_hook(event, handler)`
- [ ] 讲解 hook 只能"观察和注解"，不能替代主循环控制流
- [ ] Code 标签页：hook 注册 + 触发逻辑片段
- [ ] Deep Dive: 与 learn-claude-code s08 Hook System 对比
- [x] Bridge doc: `h14a-hook-boundary.md`（hook 的能力建立在不接管控制流这条边界上）

---

### h15 — Subagent Delegation（真实源码）

**核心问题**: 子 agent 如何共享 iteration budget？上下文如何隔离？

**Source**: `snippets/h15_subagent_delegation.py`（来自 `tools/delegate_tool.py`）

**教学任务**:
- [ ] 文档讲解 `delegate_tool.py` 的子 agent spawn 机制
- [ ] 讲解 `IterationBudget` 跨父子 agent 共享（子消耗父的预算）
- [ ] 讲解并发执行：ThreadPoolExecutor + 结果按原始顺序回填
- [ ] 讲解 context isolation：子 agent 获得干净的 message 历史
- [ ] Code 标签页：delegate spawn + budget sharing 核心逻辑
- [ ] Deep Dive: 与 learn-claude-code s04 Subagent 对比
- [x] Bridge doc: `h15a-budget-sharing.md`（delegation 的关键约束是共享预算而不是独立预算池）

---

### h16 — Provider Runtime（真实源码）

**核心问题**: Hermes 如何做到"换模型无需改代码"？

**Source**: `snippets/h16_provider_runtime.py`（来自 `hermes_cli/runtime_provider.py`, `hermes_cli/auth.py`）

**教学任务**:
- [ ] 文档讲解 `(provider, model)` → `(api_mode, api_key, base_url)` 映射架构
- [ ] 讲解 3 种 API Mode：`chat_completions` / `codex_responses` / `anthropic_messages`
- [ ] 讲解 mode resolution 优先级：explicit → provider → base_url → default
- [ ] 讲解 `CredentialPool`（多账号轮换，负载均衡）
- [ ] Code 标签页：mode resolution + credential resolution 核心逻辑
- [ ] Deep Dive: 18+ provider 支持的架构图
- [x] Bridge doc: `h16a-runtime-route.md`（provider runtime 真正统一的是 turn 级 route 结果，而不是厂商名）

---

### h17 — MCP Integration（真实源码）

**核心问题**: 外部 MCP server 的工具如何与 Hermes 原生工具共用同一条 dispatch 路径？

**Source**: `snippets/h17_mcp_integration.py`（来自 `tools/mcp_tool.py`）

**教学任务**:
- [ ] 文档讲解 MCP 协议基础（JSON-RPC over stdio，tool discovery 握手）
- [ ] 讲解 `mcp_tool.py` 动态工具发现：启动 server → list_tools → 注册到 registry
- [ ] 讲解 scoped servers：不同 context / project 连接不同 MCP server
- [ ] Code 标签页：MCP 动态工具注册逻辑片段
- [ ] Deep Dive: 与 learn-claude-code s19 MCP & Plugin 对比
- [x] Bridge doc: `h17a-mcp-capability-layers.md`（MCP 是能力层平台，tools 只是最先进入主线的一层）

---

### h18 — Plugin System（真实源码）

**核心问题**: 用户如何扩展 Hermes 而不 fork 代码？

**Source**: `snippets/h18_plugin_system.py`（来自 `hermes_cli/plugins.py`, `plugins/memory/`）

**教学任务**:
- [ ] 文档讲解 3 种插件发现源：`~/.hermes/plugins/`、`.hermes/plugins/`、pip entry_points
- [ ] 讲解 `PluginContext` API：`register_tool`, `register_hook`, `register_command`
- [ ] 讲解 memory provider 插件（专用类型，实现 `MemoryProvider` ABC）
- [ ] Code 标签页：plugin 发现 + 加载 + PluginContext 核心逻辑
- [ ] Deep Dive: plugin（注册工具/钩子）vs skill（注入操作指南）的边界
- [x] Bridge doc: `h18a-plugin-boundary.md`（plugin 扩展能力装配层，skill 扩展行为提示层）

---

### h19 — RL & Trajectories（真实源码）

**核心问题**: 如何用 Hermes 生成高质量 RL 训练数据？

**Source**: `snippets/h19_rl_trajectories.py`（来自 `batch_runner.py`, `agent/trajectory.py`）

**教学任务**:
- [ ] 文档讲解 trajectory 格式（ShareGPT format：conversations 数组）
- [ ] 讲解 `batch_runner.py` 并行轨迹生成（ThreadPoolExecutor + task queue）
- [ ] 讲解 Atropos RL environment 接入（环境 → agent → reward 循环）
- [ ] 讲解 `trajectory_compressor.py` 数据清洗（过滤低质量轨迹）
- [ ] Code 标签页：batch_runner 并发生成 + trajectory 保存逻辑
- [ ] Deep Dive: 数据生成流水线图（任务分发 → agent 执行 → 过滤 → 导出）
- [x] Bridge doc: `h19a-training-data-boundary.md`（训练难点不在日志保存，而在样本筛选与数据治理）

---

## 六、技术栈

| 层 | 技术 |
|---|---|
| Web 框架 | Next.js 15 (App Router) |
| 样式 | TailwindCSS |
| UI 组件 | shadcn/ui |
| 国际化 | next-intl |
| 代码高亮 | shiki |
| 图标 | Lucide |
| 部署 | Vercel |
| 教学 Python | Python 3.11+, openai SDK |
| 数据提取脚本 | TypeScript (tsx) |

---

## 七、实施顺序建议

```
Phase 0: 脚手架（1天）
  ↓
Phase 2: h01-h06 教学 Python（3-4天）
  ↓ （并行）
Phase 4: zh 文档 h00-h06（2-3天）
  ↓
Phase 1: Web 基础框架 + constants + chapter-guides（3天）
  ↓
Phase 3: snippets h07-h19（3天）
  ↓ （并行）
Phase 4 续: zh 文档 h07-h19（6-7天）
  ↓
Phase 6: 可视化组件数据（2天）
  ↓
Phase 5: en 文档 Layer 1（2天）
  ↓
Phase 7: 生成数据 + 验收 + 部署（1-2天）
```

**预计总工时**: 约 19-23 个工作日（独立完成）

---

## 八、章节学习指引（focus / confusion / goal）

> 对应 `web/src/lib/chapter-guides.ts`。每章三张卡片是 Deep Dive 标签的核心内容。

| 章节 | Focus（先看这里） | Confusion（常见误区） | Goal（学完能做到） |
|---|---|---|---|
| h01 | `messages` 列表和 `tool_result` 如何形成闭环 | 别把"模型在思考"和"agent 在行动"混为一谈，行动靠的是循环 | 手写一个最小但真实可运行的 Hermes 风格 agent 循环 |
| h02 | `ToolRegistry`、dispatch map、tool_result 的对应关系 | tool schema 是给模型的说明书，handler 是给代码的执行器，两者分离 | 在不改主循环的前提下添加一个新工具 |
| h03 | todo 工具在注册表**之前**被拦截的位置 | todo 不是普通工具——它修改的是 agent 状态，不经过 registry | 让 agent 把一个大目标拆成可追踪的小步骤 |
| h04 | PromptBuilder 如何按优先级组装 5 类 section | system prompt 不是一次性写死的字符串，它是运行时动态构建的 | 修改一个 section 而不影响其他 section 的输出 |
| h05 | `protect_last_n` 和 `lineage_id` 这两个参数 | 压缩不是删除历史——中间摘要 + 保留最新 N 条才是正确姿势 | 触发一次压缩，并验证新 session 能追溯到原 session |
| h06 | `session_id`、`parent_session_id` 和 FTS5 索引的关系 | SQLite 不只是存储——FTS5 全文搜索让 agent 能"记起"过去的对话 | 保存一个 session 并用关键词检索到它 |
| h07 | `memory flush` 在 turn 结束前执行的时机 | 上下文里的知识 ≠ 记忆——没写入 MEMORY.md 就等于没记住 | 验证 agent 重启后仍能用到上次写入的 memory |
| h08 | skill 注入用 `user message` 而非 `system prompt` 的原因 | skill 是操作指南，不是人格设定——别和 SOUL.md 混用 | 写一个 skill 文件并让 agent 在对话中自动调用它 |
| h09 | `DangerPattern` 正则和 `allowlist` 的匹配顺序 | 安全门不在工具内部——拦截点在工具调度层统一判断 | 添加一条自定义危险规则并验证它被正确拦截 |
| h10 | `fallback_providers` 列表的触发条件（429 / 5xx / 401） | 大多数失败不是任务失败——retry 和 fallback 是不同层级的响应 | 配置一个 fallback provider 并模拟主模型 429 触发切换 |
| h11 | `COMMAND_REGISTRY` 里一个 CommandDef 的完整字段 | slash command 不是函数调用——它是带路由规则的命令描述符 | 注册一个新 slash command 并让它在 CLI 和 Gateway 中同时生效 |
| h12 | `GatewayRunner._handle_message()` 里的 session routing 逻辑 | 平台适配层 ≠ agent 逻辑——adapter 只负责格式转换，agent 对平台无感 | 理解为什么同一个 AIAgent 能同时服务 Telegram 和 Discord |
| h13 | `jobs.json` 里 `skill_attachment` 字段的作用 | cron job 不是 shell 脚本——它是一个带完整 agent 能力的定时任务 | 创建一个每天运行、结果发到指定平台的 cron job |
| h14 | `pre_tool_call` 和 `post_tool_call` hook 的触发位置 | hook 只能观察和注解，不能替代主循环的控制流 | 写一个 hook 在每次工具调用后打印日志，而不修改主循环 |
| h15 | `IterationBudget` 如何跨父子 agent 共享 | 子 agent 的关键是干净的上下文，不是独立的 API 调用 | 用 delegate_tool 把一个子任务委派给子 agent 并拿回摘要 |
| h16 | API mode 的解析优先级（explicit → provider → base_url → default） | provider 抽象层不是 if-else——它是 (provider, model) → (api_mode, key, url) 的映射 | 添加一个新 provider 配置并让它正确解析到对应 API mode |
| h17 | MCP tool 在 `tools/registry.py` 里如何与原生工具共存 | MCP 工具不是"外挂"——它进入同一个注册表，走同一条 dispatch 路径 | 连接一个 MCP server 并验证其工具在 agent 中可直接调用 |
| h18 | `PluginContext.register_tool()` 和原生 `registry.register()` 的区别 | plugin 不是 skill——plugin 注册工具和钩子，skill 注入操作指南 | 写一个最小插件，注册一个工具，不修改任何 Hermes 核心文件 |
| h19 | `trajectory_compressor.py` 的过滤规则 | 不是所有轨迹都值得训练——过滤和格式化才是数据生成的核心 | 用 batch_runner 生成 10 条轨迹并输出为 ShareGPT 格式 |

---

## 九、实施状态总结（最后更新）

### 已完成

| 模块 | 状态 | 说明 |
|---|---|---|
| Web 脚手架 | ✅ 完成 | Next.js 15 + TailwindCSS + next-intl + shiki |
| h01-h06 教学 Python | ✅ 完成 | `agents/h01_agent_loop.py` ~ `agents/h06_session_storage.py` |
| h07-h19 源码 snippets | ✅ 完成 | `snippets/h07_memory_system.py` ~ `snippets/h19_rl_trajectories.py` |
| zh 文档 h01-h19 | ✅ 完成 | `docs/zh/h01-agent-loop.md` ~ `docs/zh/h19-rl-trajectories.md`（19 章） |
| en 文档 h01-h19 | ✅ 完成 | `docs/en/h01-agent-loop.md` ~ `docs/en/h19-rl-trajectories.md`（19 章） |
| Bridge docs zh+en | ✅ 完成 | 19 对 bridge docs（h03a ~ h19a），zh+en 各一份 |
| 补充文档 | ✅ 完成 | `glossary.md`, `data-structures.md`, `h00-architecture-overview.md` |
| Deep Dive 数据 | ✅ 完成 | `architecture-blueprints.ts`, `execution-flows.ts`, `design-decisions.ts`, `chapter-guides.ts` |
| 可视化交互组件 | ✅ 完成 | `ExecutionFlowStepper`（带播放/暂停/步进动画） |
| 国际化 i18n | ✅ 完成 | `zh.json` + `en.json` 完整覆盖所有页面（nav, home, chapter, layers, timeline, layersPage） |
| 亮色/暗色主题兼容 | ✅ 完成 | `globals.css` 添加 80+ 条 light theme override（text/bg/border/hover/accent） |
| Bridge Docs 面板 | ✅ 重构 | 从不协调布局改为 learn-claude-code 风格的简洁卡片式 |
| 页面 i18n 改造 | ✅ 完成 | `page.tsx`, `timeline/page.tsx`, `layers/page.tsx`, `compare/page.tsx`, `docs/page.tsx`, `client.tsx` |
| 构建验证 | ✅ 通过 | 129 页静态生成成功，无类型错误 |

### 待办 / 可选优化

- [ ] VERSION_META 的 title/subtitle/coreAddition/keyInsight 支持 en 翻译（当前仅 zh）
- [ ] Compare 页面的 TEXT 对象迁移到 i18n message files（当前使用本地 locale 对象，功能正常）
- [ ] Docs slug 页面的 copy 对象迁移到 i18n（当前使用本地 locale 对象，功能正常）
- [ ] 更多章节可视化交互组件（如 Agent Loop 流程图动画、Architecture 可展开架构图）
