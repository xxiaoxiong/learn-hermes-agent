# Learn Hermes Agent

> 从零理解 Hermes Agent v0.19.0 的 24 个核心机制

[English](./README.md) | [简体中文](./README-zh.md)

---

## 这是什么

本项目是 [Hermes Agent](https://github.com/NousResearch/hermes-agent) 的独立教学课程。内容已对齐 **v0.19.0（2026-07-20）**，覆盖当前的多平台、自我改进、记忆、技能、Profiles、多 Agent 编排与可靠投递架构。

与直接阅读源码不同，本项目：
- 把 Hermes 的每个核心机制拆解为**独立的一章**
- Layer 1（h01-h06）提供**可运行的最小教学实现**（Python + OpenAI SDK）
- Layer 2-4（h07-h19）提供**精选源码机制解读**
- Layer 5（h20-h24）覆盖 **v0.19 当前生产架构**
- 每章只增加**一个新概念**，循序渐进

## 快速开始

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 配置 API
cp .env.example .env
# 编辑 .env，填写 HERMES_BASE_URL / HERMES_API_KEY / HERMES_MODEL

# 3. 运行第一章
python agents/h01_agent_loop.py
```

## 章节结构

### Layer 1 — Core Single-Agent（教学实现）

| 章节 | 主题 | 核心新增 |
|---|---|---|
| h01 | Agent Loop | while 循环 + tool_result 回流 |
| h02 | Tool System | ToolRegistry — schema 与 handler 分离 |
| h03 | Planning & Todos | agent-level tool 拦截 + PlanState |
| h04 | Prompt Assembly | PromptBuilder — 5 层 section 动态组装 |
| h05 | Context Compression | preflight 压缩 + lineage_id 谱系 |
| h06 | Session Storage | SQLite + FTS5 全文搜索 |

### Layer 2 — Production Hardening（真实源码）

| 章节 | 主题 | 核心新增 |
|---|---|---|
| h07 | Memory System | MEMORY.md flush + 去重 |
| h08 | Skills System | skill 注入为 user message |
| h09 | Approval & Permission | DangerPattern 拦截 pipeline |
| h10 | Error Recovery | fallback_providers 链 |
| h11 | CLI Architecture | COMMAND_REGISTRY 多端派生 |

### Layer 3 — Multi-Platform Runtime（真实源码）

| 章节 | 主题 | 核心新增 |
|---|---|---|
| h12 | Gateway System | GatewayRunner + platform adapter |
| h13 | Cron Scheduler | jobs.json + skill attachment |
| h14 | Hook System | pre/post_tool_call 生命周期 |
| h15 | Subagent Delegation | IterationBudget 跨 agent 共享 |

### Layer 4 — Advanced Platform（真实源码）

| 章节 | 主题 | 核心新增 |
|---|---|---|
| h16 | Provider Runtime | (provider, model) → api_mode 映射 |
| h17 | MCP Integration | 动态工具发现 + 共用注册表 |
| h18 | Plugin System | PluginContext API |
| h19 | RL & Trajectories | ShareGPT 轨迹生成 + 过滤 |

### Layer 5 — Orchestration & Operations（v0.19）

| 章节 | 主题 | 核心新增 |
|---|---|---|
| h20 | Profiles | `HERMES_HOME` 身份与状态隔离 |
| h21 | Multi-Agent Kanban | 任务图、worker lane、worktree、恢复 |
| h22 | ACP & Surfaces | CLI / Desktop / Gateway / IDE 共用 AIAgent |
| h23 | Smart Security | 智能审批、user deny、SecretSource |
| h24 | Durable Delivery | 投递义务账本、ack、崩溃恢复 |

## 环境变量

| 变量 | 说明 | 示例 |
|---|---|---|
| `HERMES_BASE_URL` | OpenAI 兼容 API 地址 | `https://api.openai.com/v1` |
| `HERMES_API_KEY` | API 密钥 | `sk-...` |
| `HERMES_MODEL` | 模型名称 | `gpt-4o` |

## 项目结构

```
learn-hermes-agent/
├── agents/          # h01-h06 教学 Python 实现
│   ├── config.py    # 环境配置
│   └── h0X_*.py
├── snippets/        # h07-h19 精选 Hermes 源码片段
├── docs/
│   ├── zh/          # 中文文档
│   └── en/          # 英文文档
├── skills/          # 示例 skill 文件
├── web/             # Next.js 教学平台
├── .env.example
├── requirements.txt
└── README-zh.md
```

## 参考资料

- [Hermes Agent 源码](https://github.com/NousResearch/hermes-agent)
- [Hermes 官方架构文档](https://hermes-agent.nousresearch.com/docs/developer-guide/architecture/)
- [Hermes v0.19.0 发布说明](https://github.com/NousResearch/hermes-agent/releases/tag/v2026.7.20)
- [Learn Claude Code（本项目的教学模型参考）](../learn-claude-code/)
