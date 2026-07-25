# h20 — Profiles：Agent 身份与状态隔离

> 对齐 Hermes Agent v0.19.0。Profile 的本质不是“换一个目录”，而是为一个 Agent 身份建立完整的状态边界。

## 1. 为什么需要 Profile

同一个 Hermes 实例可能同时服务工作、个人、研究或不同团队。如果共享配置、记忆、技能和会话，Agent 会把一个场景里的知识与权限带进另一个场景。Hermes 用 `HERMES_HOME` 把这些状态整体隔离：

- `config.yaml` 与 provider 配置
- `MEMORY.md` / `USER.md`
- sessions、`state.db` 与日志
- skills、cron jobs、gateway PID
- profile 自己的 secrets

默认 profile 仍然使用 `~/.hermes`；命名 profile 使用独立目录，因此旧安装无需迁移。

## 2. 三个容易混淆的边界

| 边界 | 控制什么 |
|---|---|
| `HERMES_HOME` | Hermes 身份、配置和持久状态 |
| `terminal.cwd` | 工具从哪个项目目录开始执行 |
| OS `HOME` | `git`、`ssh`、`gh`、`npm` 等外部 CLI 去哪里找凭证 |

宿主机运行时，多个 profile 默认仍共享真实 OS `HOME`，方便复用已有 CLI 登录。如果需要严格隔离外部 CLI 身份，可启用 `terminal.home_mode: profile`，但随后必须为该 profile 单独初始化 SSH、GitHub、云 CLI 等凭证。

## 3. v0.19 的路由意义

一个 multiplexed gateway 可以根据 guild、channel 或 thread 把消息路由到不同 profile。这样同一个 bot token 背后可以运行多个完全独立的 Hermes 身份，同时避免单个 profile 配置错误拖垮整个 gateway。

## 4. 判断是否真的隔离

检查两个 profile 的 `HERMES_HOME`、memory、session DB、skills 和 secrets 是否不同；再单独确认工具进程是否需要共享 OS 凭证。不要把“Agent 数据隔离”和“操作系统账号隔离”混为一谈。

**对应官方源码区域**：`hermes_constants.py`、profile 配置与 gateway profile routing。
