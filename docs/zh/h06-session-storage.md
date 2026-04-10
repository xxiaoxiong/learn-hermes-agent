# h06 — Session Storage：SQLite + FTS5 全文索引持久化会话历史

> **核心洞察**：SQLite 不只是存储——FTS5 全文搜索让 agent 能"记起"过去的对话；`parent_session_id` 保证压缩谱系可追溯。

---

## 问题：会话历史如何跨进程保存？

当前的 `AIAgent` 在内存中维护 `self.messages`。进程退出后，一切消失。

实际使用场景需要：
1. 恢复上次对话继续工作
2. 在大量历史对话中搜索相关内容（`/search 某个关键词`）
3. 压缩后追踪谱系链（h05 的 `lineage_id`）
4. 多平台隔离（Telegram 的会话不混入 CLI 的会话）

---

## 解决方案：SQLite + FTS5

SQLite 是 Python 标准库的一部分，无需安装。FTS5 是 SQLite 的全文搜索扩展。

### 表结构

```sql
-- 主表：存储会话记录
CREATE TABLE IF NOT EXISTS sessions (
    session_id      TEXT PRIMARY KEY,
    platform        TEXT NOT NULL DEFAULT 'cli',
    messages_json   TEXT NOT NULL,          -- JSON 序列化的 messages 列表
    parent_session_id TEXT,                 -- 压缩谱系追踪
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

-- FTS5 虚拟表：全文搜索索引
CREATE VIRTUAL TABLE IF NOT EXISTS sessions_fts USING fts5(
    session_id UNINDEXED,   -- 不参与搜索，只用于关联
    platform   UNINDEXED,
    content,                -- 全部 message content 拼接，参与全文搜索
    content='sessions',     -- 内容表
    content_rowid='rowid'
);

-- 触发器：sessions 更新时自动同步 FTS5 索引
CREATE TRIGGER sessions_ai AFTER INSERT ON sessions BEGIN
    INSERT INTO sessions_fts(rowid, session_id, platform, content)
    VALUES (new.rowid, new.session_id, new.platform, new.messages_json);
END;
```

---

## 关键数据结构

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

### SessionDB 接口

```python
class SessionDB:
    def __init__(self, db_path: str = ":memory:"):
        """":memory:" 为内存数据库，文件路径为持久化数据库"""

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

## FTS5 搜索：如何工作？

```python
def search(self, query: str, platform: str | None = None,
           limit: int = 5) -> list[SessionRecord]:
    """
    全文搜索：在所有会话的 messages 内容中查找关键词。
    query 支持 FTS5 语法：AND、OR、"短语"、NOT。
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

    # ...执行查询并返回 SessionRecord 列表
```

**`rank`** 是 FTS5 的内置相关度评分，越接近查询词的结果排名越靠前。

---

## 谱系追踪的完整流程

结合 h05 的压缩机制：

```python
# 1. 初始会话
db.save_session("session-001", messages, platform="cli")

# 2. 压缩发生（h05）
compressed_messages, lineage_info = compressor.compress(messages, "session-001")
# lineage_info = {"lineage_id": "session-002", "parent_session_id": "session-001"}

# 3. 保存压缩后的新 session，记录谱系链接
db.save_session(
    "session-002",
    compressed_messages,
    platform="cli",
    parent_session_id="session-001"  # ← 关键：记录谱系
)

# 4. 搜索时能找到原始 session
results = db.search("某个关键词")
# 结果可能包含 session-001（原始）和 session-002（压缩后）
```

---

## 多平台隔离

```python
# Telegram 用户的会话
db.save_session("tg-user123-001", messages, platform="telegram")

# CLI 用户的会话  
db.save_session("cli-main-001", messages, platform="cli")

# 搜索时按平台过滤
telegram_results = db.search("关键词", platform="telegram")
# ← 只返回 Telegram 平台的会话，不混入 CLI 的
```

`platform` 字段是多平台 agent（Gateway，h12）的基础。

---

## 与 Hermes 真实代码的对应

| 教学实现 | Hermes 源码 | 说明 |
|---|---|---|
| `SessionDB` | `hermes_state.py: HermesState` | 相同的 SQLite + FTS5 设计 |
| `sessions` 表 | `sessions` 表 | 字段基本相同 |
| `sessions_fts` 虚拟表 | `sessions_fts` | 相同的 FTS5 配置 |
| `parent_session_id` | `parent_session_id` | 完全相同 |
| `search()` | `session_search_tool.py` | Hermes 把搜索包装成 agent-level tool |

Hermes 的 `session_search` 是 agent-level tool（h03 提到的概念）：agent 可以在对话中主动调用它来检索历史会话，检索结果注入到 messages 里供后续使用。

---

## 常见误区

**误区 1**：FTS5 只能搜索精确词  
→ FTS5 支持：前缀匹配（`"关键*"`）、短语（`"完整短语"`）、布尔运算（`word1 AND word2`）、排除（`NOT word`）。

**误区 2**：SQLite 不适合生产环境  
→ Hermes 用 SQLite 是经过深思熟虑的选择：zero config、跨平台、嵌入式、对于 agent 场景的并发需求绰绰有余。

**误区 3**：压缩后的 session 覆盖了原始 session  
→ 压缩产生**新 session**，原始 session 保留在数据库里。`parent_session_id` 是它们的连接线，谱系链完整保存。

---

## 动手练习

1. 运行 `python agents/h06_session_storage.py`，观察会话保存、搜索、加载的完整流程
2. 保存几个不同 platform 的会话（"cli", "telegram"），验证 platform 过滤是否正确隔离
3. 压缩一个 session 后保存，检查 `parent_session_id` 字段，沿谱系链向上追溯
