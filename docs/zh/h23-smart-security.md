# h23 — 智能审批与 Secrets：v0.19 安全控制面

> v0.19 把“每个危险命令都弹窗”升级为分层判定，同时把 API key 从明文 `.env` 推向可插拔密码库。

## 1. 命令判定顺序

1. **User deny rules**：用户明确禁止的模式最先判断，即使 yolo 模式也不能绕过。
2. **Deterministic allow**：已明确安全且匹配限定规则的动作直接执行。
3. **Smart approval**：独立 LLM reviewer 只审查当前这条具体命令。
4. **Ask / deny**：无法安全确定时仍由用户决定；`/deny <reason>` 会把拒绝原因送回 Agent 以便改道。

智能审批降低疲劳，但它不会为后续相似命令建立永久通行证。

## 2. SecretSource

新的 `SecretSource` 接口支持 Bitwarden 与 1Password `op://` 等来源。多个 vault 可同时启用，解析遵循确定优先级，并对冲突和每个变量的 provenance 给出信息。

关键设计是把“命令是否允许执行”和“执行所需密钥从哪里来”分开：审批系统不需要读取明文密钥，工具只在受控边界内得到所需值。

## 3. 安全不是单个弹窗

完整安全面还包括凭证读取 guard、敏感信息 redaction、webhook body size 限制与 profile secret scope。任何便利模式都不应越过用户的显式安全意图。

**对应官方源码区域**：`tools/approval.py`、SecretSource 与 credential guard 模块。
