# h07 — Memory System：跨会话持久记忆与 flush 时机

> **核心洞察**：上下文里的知识 ≠ 记忆——没写入 `MEMORY.md` 就等于没记住；flush 必须在 turn 结束前、压缩前执行。

---

## 问题：session 之间的知识如何保留？

h06 的 `SessionDB` 能保存完整对话历史，但：

- 每次新对话，agent 的上下文是空的
- 用户告诉过 agent "我喜欢简洁的代码风格"，下次启动后 agent 不记得了
- 压缩后，这些散落在 messages 里的知识会随着摘要而稀释

**上下文 ≠ 记忆**。真正的记忆需要主动写入持久文件。

---

## 解决方案：MEMORY.md 和 USER.md

Hermes 使用两个 markdown 文件存储跨会话记忆：

```
MEMORY.md    ← agent 对自身工作状态的记录
             （当前项目、工具使用偏好、未完成任务…）

USER.md      ← agent 对用户的了解
             （用户偏好、工作风格、常用路径…）
```

这两个文件在 `PromptBuilder` 的 `memory` section 中加载（h04 的 priority=20），成为每次对话 system prompt 的一部分。

---

## flush 时机：为什么重要？

错误的 flush 时机可能导致记忆丢失：

```
turn 1: 用户说"记住：我喜欢简洁代码"
         agent 决定写入 MEMORY.md
         ↓
         [如果在这里 flush] ✅ 记忆写入成功
         ↓
         context 压缩发生
         [如果在这里 flush] ❌ 太晚了，压缩时 memory 内容已经被摘要稀释
         ↓
         turn 结束
```

Hermes 的 flush 策略：
1. **turn 结束前**：每轮工具调用完成后，在追加 assistant 最终回答之前，强制 flush
2. **压缩前**：context compressor 触发前，先 flush 所有待写入的 memory

---

## 去重逻辑

MEMORY.md 不能无限增长。`memory_manager.py` 在写入前做去重：

```python
def write_memory(self, key: str, value: str, file: str = "MEMORY.md") -> str:
    """
    写入一条记忆：
    1. 读取现有 MEMORY.md
    2. 检查是否已有相同 key 的记录（去重）
    3. 如果超过字符上限，删除最老的条目
    4. 写入新条目
    5. 返回操作结果
    """
    current = self._read_file(file)
    entries = self._parse_entries(current)

    # 去重：已有相同 key 则更新，否则追加
    existing = next((e for e in entries if e["key"] == key), None)
    if existing:
        existing["value"] = value
        existing["updated_at"] = datetime.now().isoformat()
    else:
        entries.append({"key": key, "value": value, "updated_at": ...})

    # 字符上限控制（默认 10,000 字符）
    while self._total_chars(entries) > self.char_limit:
        entries.pop(0)  # 删除最老的条目

    self._write_file(file, self._format_entries(entries))
    return f"已写入记忆: {key}"
```

---

## memory 工具的 schema

```python
MEMORY_TOOL_SCHEMA = {
    "name": "memory_write",
    "description": "将重要信息持久化保存，跨会话可用",
    "parameters": {
        "type": "object",
        "properties": {
            "key": {"type": "string", "description": "记忆的标识符"},
            "value": {"type": "string", "description": "要记住的内容"},
            "file": {
                "type": "string",
                "enum": ["MEMORY.md", "USER.md"],
                "description": "写入哪个文件：MEMORY.md（工作记忆）或 USER.md（用户信息）",
            },
        },
        "required": ["key", "value"],
    },
}
```

`memory_write` 是 agent-level tool（h03 的概念）：在 `ToolRegistry.dispatch()` 之前被主循环拦截，直接调用 `memory_manager.write_memory()`。

---

## 临时上下文 vs 持久记忆的决策树

```
这条信息需要跨会话保留吗？
├── 是 → 写入 MEMORY.md 或 USER.md
│        是关于用户的信息？→ USER.md
│        是关于工作状态的信息？→ MEMORY.md
└── 否 → 留在 messages 上下文里即可
         （会话结束后自然消失）
```

---

## 代码解读：snippets/h07_memory_system.py

本章的 Code 标签展示了 Hermes `agent/memory_manager.py` 和 `tools/memory_tool.py` 的精选片段，关注：

1. **`MemoryManager.flush()`** — 批量 flush 所有待写入条目
2. **去重算法** — 同 key 更新，超限删旧
3. **`memory_write` handler** — 如何包装成 agent-level tool

---

## 常见误区

**误区 1**：把所有信息都写入 MEMORY.md  
→ 记忆应该是精华，不是流水账。字符上限（10,000）会自动删除最老的条目；写太多会让重要信息被挤掉。

**误区 2**：MEMORY.md 里的内容不会影响当次对话  
→ MEMORY.md 在每次 `build_system_prompt()` 时被读取，注入到 system prompt 的 memory section。写入 MEMORY.md 后，**下一次**对话就能用到。

**误区 3**：flush 可以在 session 结束时一次性做  
→ 如果进程在 session 结束前崩溃，所有待 flush 的记忆都会丢失。Hermes 在 turn 级别做 flush，最坏情况下只丢失当前 turn 的记忆。
