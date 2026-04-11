# h06 — Session Storage: SQLite + FTS5 Full-Text Indexed Session Persistence

> **Core Insight**: SQLite is not just storage — FTS5 full-text search lets the agent "remember" past conversations; `parent_session_id` ensures the compression lineage remains traceable.

---

## The Problem: How to Persist Session History Across Processes?

The current `AIAgent` maintains `self.messages` in memory. When the process exits, everything is lost.

Real-world usage requires:
1. Resuming the previous conversation and continuing work
2. Searching through a large history of conversations (`/search some keyword`)
3. Tracking the lineage chain after compression (h05's `lineage_id`)
4. Multi-platform isolation (Telegram sessions must not mix with CLI sessions)

---

## The Solution: SQLite + FTS5

SQLite is part of the Python standard library — no installation needed. FTS5 is SQLite's full-text search extension.

### Table Schema

```sql
-- Main table: stores session records
CREATE TABLE IF NOT EXISTS sessions (
    session_id      TEXT PRIMARY KEY,
    platform        TEXT NOT NULL DEFAULT 'cli',
    messages_json   TEXT NOT NULL,          -- JSON-serialized messages list
    parent_session_id TEXT,                 -- Compression lineage tracking
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

-- FTS5 virtual table: full-text search index
CREATE VIRTUAL TABLE IF NOT EXISTS sessions_fts USING fts5(
    session_id UNINDEXED,   -- Not searchable, only used for joining
    platform   UNINDEXED,
    content,                -- All message content concatenated, participates in search
    content='sessions',     -- Content table
    content_rowid='rowid'
);

-- Trigger: auto-sync FTS5 index when sessions are updated
CREATE TRIGGER sessions_ai AFTER INSERT ON sessions BEGIN
    INSERT INTO sessions_fts(rowid, session_id, platform, content)
    VALUES (new.rowid, new.session_id, new.platform, new.messages_json);
END;
```

---

## Key Data Structures

### SessionRecord

```python
from dataclasses import dataclass

@dataclass
class SessionRecord:
    session_id: str
    platform: str
    messages: list[dict]
    parent_session_id: str | None
    created_at: str
    updated_at: str
```

### SessionDB Interface

```python
class SessionDB:
    def __init__(self, db_path: str = ":memory:"):
        """":memory:" for in-memory database, file path for persistent storage"""

    def save_session(self, session_id: str, messages: list[dict],
                     platform: str = "cli",
                     parent_session_id: str | None = None) -> None: ...

    def load_session(self, session_id: str) -> SessionRecord | None: ...

    def search(self, query: str, platform: str | None = None,
               limit: int = 5) -> list[SessionRecord]: ...

    def list_sessions(self, platform: str | None = None,
                      limit: int = 20) -> list[SessionRecord]: ...
```

---

## FTS5 Search: How It Works

```python
def search(self, query: str, platform: str | None = None,
           limit: int = 5) -> list[SessionRecord]:
    """
    Full-text search: find keywords across all session message content.
    query supports FTS5 syntax: AND, OR, "phrases", NOT.
    """
    sql = """
        SELECT s.session_id, s.platform, s.messages_json,
               s.parent_session_id, s.created_at, s.updated_at
        FROM sessions s
        JOIN sessions_fts fts ON s.session_id = fts.session_id
        WHERE sessions_fts MATCH ?
    """
    params = [query]

    if platform:
        sql += " AND fts.platform = ?"
        params.append(platform)

    sql += " ORDER BY rank LIMIT ?"
    params.append(limit)

    # ...execute query and return SessionRecord list
```

**`rank`** is FTS5's built-in relevance score; results closer to the query terms are ranked higher.

---

## Complete Lineage Tracking Flow

Combined with h05's compression mechanism:

```python
# 1. Initial session
db.save_session("session-001", messages, platform="cli")

# 2. Compression occurs (h05)
compressed_messages, lineage_info = compressor.compress(messages, "session-001")
# lineage_info = {"lineage_id": "session-002", "parent_session_id": "session-001"}

# 3. Save the compressed new session, recording the lineage link
db.save_session(
    "session-002",
    compressed_messages,
    platform="cli",
    parent_session_id="session-001"  # ← key: records lineage
)

# 4. Search can find the original session
results = db.search("some keyword")
# Results may include session-001 (original) and session-002 (compressed)
```

---

## Multi-Platform Isolation

```python
# Telegram user's session
db.save_session("tg-user123-001", messages, platform="telegram")

# CLI user's session
db.save_session("cli-main-001", messages, platform="cli")

# Search filtered by platform
telegram_results = db.search("keyword", platform="telegram")
# ← Returns only Telegram platform sessions, not mixed with CLI
```

The `platform` field is the foundation for the multi-platform agent (Gateway, h12).

---

## Mapping to Real Hermes Code

| Teaching Implementation | Hermes Source | Notes |
|---|---|---|
| `SessionDB` | `hermes_state.py: HermesState` | Same SQLite + FTS5 design |
| `sessions` table | `sessions` table | Fields are essentially the same |
| `sessions_fts` virtual table | `sessions_fts` | Same FTS5 configuration |
| `parent_session_id` | `parent_session_id` | Identical |
| `search()` | `session_search_tool.py` | Hermes wraps the search as an agent-level tool |

Hermes' `session_search` is an agent-level tool (the concept from h03): the agent can proactively call it during conversation to retrieve past sessions, and the results are injected into messages for subsequent use.

---

## Common Misconceptions

**Misconception 1**: FTS5 can only search for exact words  
→ FTS5 supports: prefix matching (`"key*"`), phrases (`"exact phrase"`), boolean operations (`word1 AND word2`), exclusion (`NOT word`).

**Misconception 2**: SQLite is not suitable for production  
→ Hermes' use of SQLite is a deliberate choice: zero config, cross-platform, embedded, and more than adequate for the concurrency demands of agent scenarios.

**Misconception 3**: The compressed session overwrites the original session  
→ Compression creates a **new session**; the original session remains in the database. `parent_session_id` is the link between them, keeping the lineage chain intact.

---

## Hands-On Exercises

1. Run `python agents/h06_session_storage.py` and observe the full flow of saving, searching, and loading sessions
2. Save several sessions with different platforms ("cli", "telegram") and verify that platform filtering correctly isolates them
3. Compress a session and save it, check the `parent_session_id` field, and trace the lineage chain upward
