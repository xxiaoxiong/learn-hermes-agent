# h00 — Hermes Agent 全景架构

> 这是整个课程的地图。在深入每一章之前，先在脑子里建立一张 Hermes 的全局视图。

---

## 1. Hermes 是什么

Hermes Agent 是一个**生产级 AI Agent 框架**，核心能力：

- 通过工具与操作系统/网络交互（bash、文件读写、HTTP 请求）
- 支持 15+ 即时通讯平台的 Gateway 接入（Telegram、Discord、Slack…）
- 多模型 / 多 Provider 运行（OpenAI、Anthropic、OpenRouter…）
- 完整的会话持久化与上下文压缩机制
- 插件、Skill、MCP 等多维度扩展接口

---

## 2. 四层架构

Hermes 的 19 个核心机制被划分为 4 层，每层解决一类问题：

```
Layer 1: Core Single-Agent      h01 – h06
  "一个 agent 能做到什么最低限度"
  消息循环 → 工具系统 → 任务规划 → Prompt 组装 → 上下文压缩 → 会话存储

Layer 2: Production Hardening   h07 – h11
  "一个 agent 如何可靠工作"
  记忆系统 → Skills → 权限拦截 → 错误恢复 → CLI 架构

Layer 3: Multi-Platform Runtime h12 – h15
  "一个 agent 如何服务多个平台"
  Gateway → Cron → Hook → 子 Agent

Layer 4: Advanced Platform      h16 – h19
  "一个 agent 如何成为可扩展平台"
  Provider Runtime → MCP → 插件 → RL 轨迹
```

---

## 3. 核心组件与文件映射

### 3.1 主循环

| 文件 | 作用 |
|---|---|
| `run_agent.py` | `AIAgent` 类：消息循环、工具 dispatch、预算控制 |
| `tools/registry.py` | `ToolRegistry`：schema + handler 注册表 |
| `agent/prompt_builder.py` | `PromptBuilder`：5 层 section 动态组装 system prompt |
| `agent/context_compressor.py` | `ContextCompressor`：上下文压缩策略 |
| `hermes_state.py` | `HermesState`：SQLite 会话持久化 + FTS5 |

### 3.2 生产加固

| 文件 | 作用 |
|---|---|
| `agent/memory_manager.py` | `MEMORY.md` / `USER.md` 写入与去重 |
| `tools/memory_tool.py` | memory 写入工具 handler |
| `agent/skill_commands.py` | Skill 文件发现与 user message 注入 |
| `tools/approval.py` | `DangerPattern` 检测 + allowlist + callback |

### 3.3 Gateway 与多平台

| 文件 | 作用 |
|---|---|
| `gateway/run.py` | `GatewayRunner`：消息分发主循环 |
| `gateway/platforms/` | 各平台 Adapter（Telegram、Discord、Slack…） |
| `cron/scheduler.py` | 定时任务调度器 |
| `gateway/hooks.py` | HookEvent 生命周期管理 |
| `tools/delegate_tool.py` | 子 Agent spawn + budget 共享 |

### 3.4 平台能力

| 文件 | 作用 |
|---|---|
| `hermes_cli/runtime_provider.py` | Provider resolution：provider → api_mode |
| `hermes_cli/auth.py` | `CredentialPool`：多账号轮换 |
| `tools/mcp_tool.py` | MCP server 动态工具发现 |
| `hermes_cli/plugins.py` | `PluginContext`：插件注册接口 |
| `batch_runner.py` | RL 轨迹并行生成 |

---

## 4. 数据流

### 4.1 单次对话的完整数据流

```
用户输入
  └─→ run_agent.py: AIAgent.run_conversation()
        └─→ prompt_builder.py: 组装 system prompt（含 MEMORY.md / skills）
        └─→ OpenAI/Anthropic API 调用
        └─→ 解析 tool_calls
              └─→ approval.py: 危险检测
              └─→ registry.py: dispatch 到对应 handler
              └─→ 工具结果追加到 messages
        └─→ 重复循环直到模型停止调用工具
        └─→ memory_manager.py: turn 结束前 flush 记忆
        └─→ hermes_state.py: 保存会话到 SQLite
```

### 4.2 Gateway 接入的数据流

```
平台消息（Telegram / Discord…）
  └─→ gateway/platforms/[adapter].py: 转换为 MessageEvent
  └─→ gateway/run.py: GatewayRunner._handle_message()
        └─→ session routing（platform + user_id → session_key）
        └─→ AIAgent.run_conversation() （与上面相同的流程）
        └─→ delivery：结果发回平台
```

---

## 5. 关键设计决策

### 决策 1：工具 schema 与 handler 分离

模型只看 schema，代码只调 handler，两者通过 `name` 绑定。添加工具不动主循环。

### 决策 2：todo 工具在注册表之前被拦截

`todo` 修改的是 agent 内部状态（PlanState），不经过 ToolRegistry。这保证了 agent 的自我追踪不依赖外部工具的注册顺序。

### 决策 3：skill 用 user message 注入，不用 system prompt

保持 system prompt 的内容稳定，确保 Anthropic prompt caching 的 cache 命中率。

### 决策 4：压缩保谱系，不直接删历史

压缩产生新的 session（新 `lineage_id`），原 session 仍存在 SQLite 里，可通过 FTS5 检索。

### 决策 5：安全门在调度层，不在工具内部

`approval.py` 在 ToolRegistry dispatch 之前拦截所有工具调用，确保统一的危险检测逻辑。

---

## 6. 教学路线建议

```
必读（Layer 1）：h01 → h02 → h03 → h04 → h05 → h06
  这 6 章建立核心心智模型。每章只引入一个新概念，可独立运行。

按需读（Layer 2）：h07 → h08 → h09 → h10 → h11
  生产加固层，按需阅读。

选读（Layer 3 & 4）：h12 → h19
  多平台与高级能力，根据实际需求选择。
```

---

> **提示**：每一章的 Code 标签页展示对应的 Python 实现（h01-h06 为教学实现，h07-h19 为 Hermes 精选源码片段）。建议边读文档边看代码，对照理解。
