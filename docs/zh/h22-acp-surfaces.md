# h22 — ACP 与多端入口：一个内核，多种交互面

> Hermes 的 CLI、TUI、Desktop、Gateway、API Server、Python Library 与 ACP 不是多套 Agent；它们是同一个 `AIAgent` 的不同入口。

## 1. 统一内核

所有入口最终都复用 `AIAgent.run_conversation()`，因此 provider resolution、prompt assembly、tool dispatch、compression 与 session persistence 的语义一致。平台层只负责：

- 把输入规范化为 session + message
- 把 reasoning、text、tool call、progress 等事件映射到客户端
- 处理中断、重试与客户端能力差异

## 2. ACP 的位置

Agent Client Protocol 通过 stdio/JSON-RPC 把 Hermes 暴露给 VS Code、Zed 与 JetBrains 等编辑器。ACP adapter 不重写主循环；它把 IDE 的请求、权限和流式事件翻译到 Hermes 的统一事件模型。

## 3. 为什么这个边界重要

如果每个客户端都实现一套 Agent Loop，工具行为、审批、安全和会话语义会迅速分叉。入口适配意味着新客户端只需解决协议桥接，核心能力仍由同一内核升级。

**对应官方源码区域**：`acp_adapter/`、`cli.py`、`gateway/run.py`、Desktop/TUI 事件层。
