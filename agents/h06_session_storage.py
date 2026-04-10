"""
h06 — Session Storage
═══════════════════════════════════════════════════════════════
coreAddition : SQLite + FTS5 全文索引持久化会话历史
keyInsight   : SQLite 不只是存储——FTS5 全文搜索让 agent 能"记起"
               过去的对话；parent_session_id 保证压缩谱系可追溯

对应 Hermes 源码 : hermes-agent/hermes_state.py → SessionDB
                  hermes-agent/tools/session_search_tool.py
═══════════════════════════════════════════════════════════════
"""
import json
import sqlite3
import uuid
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from openai import OpenAI
from config import BASE_URL, API_KEY, MODEL
from h02_tool_system import ToolRegistry, build_default_registry
from h05_context_compression import ContextCompressor, CompressionPolicy


# ── Session 数据结构 ──────────────────────────────────────────────

@dataclass
class SessionRecord:
    """
    一条会话记录。

    session_id       : 唯一 ID（压缩后会更新）
    platform         : 来源平台（cli / telegram / discord / ...）
    messages         : 完整 messages 列表（JSON 序列化存储）
    created_at       : 创建时间
    parent_session_id: 压缩谱系的父 ID（None 表示原始 session）
    """
    session_id: str
    platform: str
    messages: list[dict]
    created_at: str
    parent_session_id: str | None = None


# ── SessionDB ────────────────────────────────────────────────────

class SessionDB:
    """
    基于 SQLite + FTS5 的会话持久化存储。

    表结构：
      sessions     — 主表（session_id, platform, messages_json, ...）
      sessions_fts — FTS5 虚拟表（全文索引，关联 sessions.rowid）

    FTS5 使得 /search 命令能按关键词检索历史会话，
    这正是 Hermes 中 session_search agent-level tool 的底层机制。
    """

    CREATE_SESSIONS = """
        CREATE TABLE IF NOT EXISTS sessions (
            session_id        TEXT PRIMARY KEY,
            platform          TEXT NOT NULL DEFAULT 'cli',
            messages_json     TEXT NOT NULL,
            created_at        TEXT NOT NULL,
            parent_session_id TEXT
        )
    """

    CREATE_FTS = """
        CREATE VIRTUAL TABLE IF NOT EXISTS sessions_fts
        USING fts5(session_id UNINDEXED, content, content='sessions', content_rowid='rowid')
    """

    CREATE_FTS_TRIGGER_INSERT = """
        CREATE TRIGGER IF NOT EXISTS sessions_fts_insert
        AFTER INSERT ON sessions BEGIN
            INSERT INTO sessions_fts(rowid, session_id, content)
            VALUES (new.rowid, new.session_id, new.messages_json);
        END
    """

    CREATE_FTS_TRIGGER_UPDATE = """
        CREATE TRIGGER IF NOT EXISTS sessions_fts_update
        AFTER UPDATE ON sessions BEGIN
            INSERT INTO sessions_fts(sessions_fts, rowid, session_id, content)
            VALUES ('delete', old.rowid, old.session_id, old.messages_json);
            INSERT INTO sessions_fts(rowid, session_id, content)
            VALUES (new.rowid, new.session_id, new.messages_json);
        END
    """

    def __init__(self, db_path: str = ":memory:"):
        self.db_path = db_path
        self._conn = sqlite3.connect(db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._init_schema()

    def _init_schema(self) -> None:
        with self._conn:
            self._conn.execute(self.CREATE_SESSIONS)
            self._conn.execute(self.CREATE_FTS)
            self._conn.execute(self.CREATE_FTS_TRIGGER_INSERT)
            self._conn.execute(self.CREATE_FTS_TRIGGER_UPDATE)

    def save_session(self, record: SessionRecord) -> None:
        """保存或更新一条会话记录"""
        with self._conn:
            self._conn.execute(
                """
                INSERT INTO sessions (session_id, platform, messages_json, created_at, parent_session_id)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(session_id) DO UPDATE SET
                    messages_json = excluded.messages_json,
                    parent_session_id = excluded.parent_session_id
                """,
                (
                    record.session_id,
                    record.platform,
                    json.dumps(record.messages, ensure_ascii=False),
                    record.created_at,
                    record.parent_session_id,
                ),
            )

    def load_session(self, session_id: str) -> SessionRecord | None:
        """按 session_id 加载会话记录"""
        row = self._conn.execute(
            "SELECT * FROM sessions WHERE session_id = ?", (session_id,)
        ).fetchone()
        if not row:
            return None
        return SessionRecord(
            session_id=row["session_id"],
            platform=row["platform"],
            messages=json.loads(row["messages_json"]),
            created_at=row["created_at"],
            parent_session_id=row["parent_session_id"],
        )

    def search(self, query: str, platform: str | None = None, limit: int = 5) -> list[SessionRecord]:
        """
        FTS5 全文搜索历史会话。

        对应 Hermes 的 /search 命令和 session_search agent-level tool。
        platform 参数实现多平台隔离（不同平台的 session 互不干扰）。
        """
        if platform:
            sql = """
                SELECT s.* FROM sessions s
                JOIN sessions_fts f ON s.rowid = f.rowid
                WHERE sessions_fts MATCH ? AND s.platform = ?
                ORDER BY rank LIMIT ?
            """
            rows = self._conn.execute(sql, (query, platform, limit)).fetchall()
        else:
            sql = """
                SELECT s.* FROM sessions s
                JOIN sessions_fts f ON s.rowid = f.rowid
                WHERE sessions_fts MATCH ? ORDER BY rank LIMIT ?
            """
            rows = self._conn.execute(sql, (query, limit)).fetchall()

        return [
            SessionRecord(
                session_id=r["session_id"],
                platform=r["platform"],
                messages=json.loads(r["messages_json"]),
                created_at=r["created_at"],
                parent_session_id=r["parent_session_id"],
            )
            for r in rows
        ]

    def list_sessions(self, platform: str | None = None, limit: int = 20) -> list[dict]:
        """列出最近的会话（用于 /history 命令）"""
        if platform:
            rows = self._conn.execute(
                "SELECT session_id, platform, created_at, parent_session_id "
                "FROM sessions WHERE platform = ? ORDER BY created_at DESC LIMIT ?",
                (platform, limit),
            ).fetchall()
        else:
            rows = self._conn.execute(
                "SELECT session_id, platform, created_at, parent_session_id "
                "FROM sessions ORDER BY created_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [dict(r) for r in rows]

    def get_lineage(self, session_id: str) -> list[str]:
        """
        追溯压缩谱系，返回从当前 session 到最原始 session 的 ID 路径。

        Hermes 用此功能实现 /resume 时的上下文恢复。
        """
        lineage = [session_id]
        current = session_id
        visited = set()
        while True:
            if current in visited:
                break
            visited.add(current)
            row = self._conn.execute(
                "SELECT parent_session_id FROM sessions WHERE session_id = ?",
                (current,),
            ).fetchone()
            if not row or not row["parent_session_id"]:
                break
            current = row["parent_session_id"]
            lineage.append(current)
        return lineage


class AIAgent:
    """
    h06 版 AIAgent：集成 SessionDB，每次对话自动持久化。

    与 h05 的差异：
      h05: messages 只在内存，进程退出即丢失
      h06: 每轮 turn 结束后自动保存到 SQLite，支持跨进程 /resume
    """

    def __init__(
        self,
        registry: ToolRegistry | None = None,
        db: SessionDB | None = None,
        platform: str = "cli",
        session_id: str | None = None,
        max_iterations: int = 15,
    ):
        self.client = OpenAI(base_url=BASE_URL, api_key=API_KEY)
        self.registry = registry or build_default_registry()
        self.db = db or SessionDB()
        self.compressor = ContextCompressor()
        self.platform = platform
        self.session_id = session_id or str(uuid.uuid4())[:8]
        self.parent_session_id: str | None = None
        self.max_iterations = max_iterations
        self.messages: list[dict] = []

        # 如果传入了 session_id，尝试从 DB 恢复
        if session_id:
            record = self.db.load_session(session_id)
            if record:
                self.messages = record.messages
                self.parent_session_id = record.parent_session_id
                print(f"[恢复] session {session_id}，{len(self.messages)} 条历史消息")

    def _persist(self) -> None:
        """将当前状态持久化到数据库"""
        self.db.save_session(SessionRecord(
            session_id=self.session_id,
            platform=self.platform,
            messages=self.messages,
            created_at=datetime.now().isoformat(),
            parent_session_id=self.parent_session_id,
        ))

    def run_conversation(self, user_message: str) -> str:
        self.messages.append({"role": "user", "content": user_message})

        for _ in range(self.max_iterations):
            if self.compressor.should_compress(self.messages):
                self.messages, comp_result = self.compressor.compress(
                    self.messages, self.session_id
                )
                if comp_result.compressed:
                    self.parent_session_id = comp_result.parent_session_id
                    self.session_id = comp_result.new_session_id

            response = self.client.chat.completions.create(
                model=MODEL,
                messages=self.messages,
                tools=self.registry.get_schemas(),
            )
            message = response.choices[0].message
            self.messages.append(message.model_dump(exclude_unset=True))

            if message.tool_calls:
                for tc in message.tool_calls:
                    args = json.loads(tc.function.arguments)
                    result_obj = self.registry.dispatch(tc.function.name, args)
                    self.messages.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": str(result_obj),
                    })
                continue

            reply = message.content or ""
            self._persist()  # turn 结束后持久化
            return reply

        self._persist()
        return f"[达到最大迭代次数 {self.max_iterations}]"


# ── 演示 ─────────────────────────────────────────────────────────
if __name__ == "__main__":
    db = SessionDB(db_path="sessions_demo.db")
    agent = AIAgent(db=db, platform="cli")
    sid = agent.session_id
    print(f"[新 session] {sid}")

    agent.run_conversation("你好，记住我叫小明")
    agent.run_conversation("列出当前目录的文件")

    print(f"\n── 搜索包含'小明'的会话 ──")
    results = db.search("小明")
    for r in results:
        print(f"  session: {r.session_id}  消息数: {len(r.messages)}")

    print(f"\n── 谱系追溯 ──")
    lineage = db.get_lineage(agent.session_id)
    print(f"  {' → '.join(lineage)}")

    print(f"\n── 恢复 session 并继续对话 ──")
    agent2 = AIAgent(db=db, platform="cli", session_id=sid)
    reply = agent2.run_conversation("我叫什么名字？")
    print(f"  Agent: {reply}")
