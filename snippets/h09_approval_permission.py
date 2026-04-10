# ============================================================
# H09: Approval & Permission — Hermes Real Source Snippets
# Source: tools/approval.py
#
# 核心洞察：安全门不在工具内部
# 拦截点在工具调度层统一判断，所有工具都经过同一套权限逻辑。
# Pipeline: deny → check_dangerous → allowlist → ask_user
# ============================================================


# ── tools/approval.py: 68-126 — DANGEROUS_PATTERNS ─────────────────────────
# KEY: 规则是正则表达式 + 描述的 tuple 列表，检测函数遍历这个列表
DANGEROUS_PATTERNS = [
    (r'\brm\s+(-[^\s]*\s+)*/', "delete in root path"),
    (r'\brm\s+-[^\s]*r', "recursive delete"),
    (r'\brm\s+--recursive\b', "recursive delete (long flag)"),
    (r'\bchmod\s+(-[^\s]*\s+)*(777|666|o\+[rwx]*w|a\+[rwx]*w)\b', "world/other-writable permissions"),
    (r'\bchown\s+(-[^\s]*)?R\s+root', "recursive chown to root"),
    (r'\bmkfs\b', "format filesystem"),
    (r'\bdd\s+.*if=', "disk copy"),
    (r'>\s*/dev/sd', "write to block device"),
    (r'\bDROP\s+(TABLE|DATABASE)\b', "SQL DROP"),
    (r'\bDELETE\s+FROM\b(?!.*\bWHERE\b)', "SQL DELETE without WHERE"),
    (r'\bTRUNCATE\s+(TABLE)?\s*\w', "SQL TRUNCATE"),
    (r'>\s*/etc/', "overwrite system config"),
    (r'\bsystemctl\s+(stop|disable|mask)\b', "stop/disable system service"),
    (r'\bkill\s+-9\s+-1\b', "kill all processes"),
    (r':\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:', "fork bomb"),
    (r'\b(bash|sh|zsh|ksh)\s+-[^\s]*c(\s+|$)', "shell command via -c/-lc flag"),
    (r'\b(curl|wget)\b.*\|\s*(ba)?sh\b', "pipe remote content to shell"),
    (r'\bgit\s+reset\s+--hard\b', "git reset --hard (destroys uncommitted changes)"),
    (r'\bgit\s+push\b.*--force\b', "git force push (rewrites remote history)"),
    (r'\bgit\s+push\b.*-f\b', "git force push short flag"),
    (r'\bgit\s+clean\s+-[^\s]*f', "git clean with force (deletes untracked files)"),
    # ... more patterns
]


# ── tools/approval.py: 156-185 — Detection pipeline ────────────────────────
def _normalize_command_for_detection(command: str) -> str:
    """Normalize a command string before dangerous-pattern matching.

    Strips ANSI escape sequences, null bytes, and normalizes Unicode fullwidth
    characters so that obfuscation techniques cannot bypass pattern detection.
    """
    from tools.ansi_strip import strip_ansi
    import unicodedata
    command = strip_ansi(command)
    command = command.replace('\x00', '')
    # Normalize Unicode (fullwidth Latin, halfwidth Katakana, etc.)
    command = unicodedata.normalize('NFKC', command)
    return command


def detect_dangerous_command(command: str) -> tuple:
    """Check if a command matches any dangerous patterns.

    Returns:
        (is_dangerous, pattern_key, description) or (False, None, None)

    KEY: 所有工具调用都先经过这里再 dispatch——安全门在调度层，不在工具内部
    """
    command_lower = _normalize_command_for_detection(command).lower()
    for pattern, description in DANGEROUS_PATTERNS:
        if re.search(pattern, command_lower, re.IGNORECASE | re.DOTALL):
            pattern_key = description
            return (True, pattern_key, description)
    return (False, None, None)


# ── tools/approval.py: 188-218 — Per-session approval state ────────────────
# Thread-safe state: session_key → approved set
_lock = threading.Lock()
_pending: dict = {}
_session_approved: dict = {}   # session_key → set of approved pattern_keys
_session_yolo: set = set()      # sessions with /yolo (approve all)
_permanent_approved: set = set()  # persisted in config.yaml command_allowlist


# ── Approval Pipeline (called from bash_tool before command execution) ──────
#
# 1. check if YOLO mode (always allow) → execute
# 2. detect_dangerous_command(cmd)     → if not dangerous, execute
# 3. check permanent allowlist         → if approved, execute
# 4. check session approvals           → if already approved this session, execute
# 5. prompt user (CLI: sync input / Gateway: async notify + block)
#    → "once" | "session" | "always" | "deny"
#
# The check is wired into the bash tool handler, NOT inside run_agent.py's main loop.
# This means every tool that runs shell commands goes through the same gate.


# ── Gateway: async approval via threading.Event ─────────────────────────────
class _ApprovalEntry:
    """One pending dangerous-command approval inside a gateway session."""
    __slots__ = ("event", "data", "result")

    def __init__(self, data: dict):
        self.event = threading.Event()
        self.data = data          # command, description, pattern_keys
        self.result = None        # "once"|"session"|"always"|"deny"


# gateway approval flow:
# 1. Agent thread detects dangerous command → creates _ApprovalEntry → blocks on event
# 2. notify_cb sends approval request to user (Telegram, Discord, etc.)
# 3. User replies /approve → resolve_gateway_approval() → sets result → event.set()
# 4. Agent thread unblocks and checks result

def register_gateway_notify(session_key: str, cb) -> None:
    """Register a per-session callback for sending approval requests to the user.

    cb(approval_data: dict) -> None
    Bridges sync (agent thread) → async (event loop for sending messages).
    """
    with _lock:
        _gateway_notify_cbs[session_key] = cb
