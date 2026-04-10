# h08 — Skills System：skill 注入为 user message，维护 prompt cache

> **核心洞察**：skill 是操作指南，不是人格设定——注入为 user message 是为了不破坏 system prompt 的 cache 命中率。

---

## 问题：如何让 agent 掌握特定领域的操作规范？

有些知识不适合放在 `MEMORY.md`（那里存储状态，不是操作规范），也不适合写死在 system prompt 里（太长太杂）。

例如：
- "处理 Python 代码时，始终遵循 PEP8，使用类型注解"
- "分析数据时，先检查缺失值，再做统计"
- "代码审查时，关注这 5 个维度：…"

这些是**操作指南**（How to do），不是身份设定（Who you are）。

---

## Skill 文件格式

Skill 是带 YAML frontmatter 的 markdown 文件：

```markdown
---
name: python-expert
description: Python 代码编写与审查专家模式
trigger: python|代码|脚本
---

## Python 代码规范

处理 Python 代码时，请遵循以下规范：

1. **类型注解**：所有函数参数和返回值都应有类型注解
2. **文档字符串**：使用 Google 风格的 docstring
3. **错误处理**：使用具体的异常类型，不用裸 `except:`
4. **测试优先**：复杂逻辑先写测试

## 代码审查检查点

- [ ] 有无未处理的 None 值
- [ ] 有无魔法数字（应提取为常量）
- [ ] 异常是否被正确传播
```

---

## Skill Discovery：两个扫描位置

```python
def discover_skills(project_dir: str = ".") -> list[SkillFile]:
    """
    扫描两个位置的 skill 文件：
    1. 项目级：.hermes/skills/（优先级更高）
    2. 用户级：~/.hermes/skills/（全局默认）
    """
    skills = []

    # 项目级 skills（覆盖用户级同名 skill）
    project_skills_dir = os.path.join(project_dir, ".hermes", "skills")
    if os.path.isdir(project_skills_dir):
        skills.extend(_load_dir(project_skills_dir))

    # 用户级 skills
    user_skills_dir = os.path.expanduser("~/.hermes/skills")
    if os.path.isdir(user_skills_dir):
        existing_names = {s.name for s in skills}
        for skill in _load_dir(user_skills_dir):
            if skill.name not in existing_names:  # 不覆盖项目级同名 skill
                skills.append(skill)

    return skills
```

---

## 为什么用 user message 注入，而不是 system prompt？

这是 h08 最关键的设计决策。

### 方案 A：注入 system prompt（直觉做法）

```python
# ❌ 每次加载不同 skill，system prompt 就变了
system_prompt = build_system_prompt() + "\n\n" + skill.content
```

问题：Anthropic 的 prompt caching 以固定前缀为单位缓存。如果不同请求的 system prompt 不一样，cache 全部 miss，每次都要重新计算，成本翻倍。

### 方案 B：注入 user message（Hermes 的选择）

```python
# ✅ system prompt 保持不变，skill 以 user message 形式注入
messages = [
    {
        "role": "user",
        "content": f"[Skill: {skill.name}]\n\n{skill.content}\n\n---\n\n{actual_user_message}"
    }
]
```

system prompt（personality + memory + tool_guidance）保持完全一样，前缀 cache 命中。skill 内容只影响当次对话的第一条 user message，不影响 cache。

---

## 触发机制

Skill 可以通过两种方式激活：

### 1. 自动触发（基于 frontmatter 中的 trigger 关键词）

```python
def match_skills(user_message: str, skills: list[SkillFile]) -> list[SkillFile]:
    """检查用户消息是否匹配 skill 的 trigger 正则"""
    matched = []
    for skill in skills:
        if skill.trigger and re.search(skill.trigger, user_message, re.IGNORECASE):
            matched.append(skill)
    return matched
```

### 2. 手动触发（slash command）

```
/skill python-expert
```

`/skill` 是 CLI 命令（h11），直接激活指定 skill。

---

## Skill vs Memory：边界

| | Skill | Memory |
|---|---|---|
| 存储内容 | 操作指南（How to do） | 状态记录（What happened） |
| 文件 | `.hermes/skills/*.md` | `MEMORY.md`, `USER.md` |
| 注入方式 | user message | system prompt（memory section） |
| 生命周期 | 会话内 | 跨会话持久 |
| 更新频率 | 人工维护 | agent 自动写入 |

---

## 代码解读：snippets/h08_skills_system.py

本章的 Code 标签展示了 `agent/skill_commands.py` 的精选片段，关注：

1. **`SkillFile` dataclass** — frontmatter 解析与 trigger 字段
2. **`discover_skills()`** — 双路径扫描逻辑
3. **注入位置** — 如何把 skill 内容拼接到第一条 user message

---

## 常见误区

**误区 1**：skill 和 SOUL.md 是同一类东西  
→ SOUL.md 是人格（system prompt 的 personality section），是身份的一部分，始终存在。Skill 是特定任务的操作指南，按需激活。

**误区 2**：可以把所有 skill 都加载进来  
→ skill 内容会消耗 token。只激活当前任务相关的 skill，是正确的做法。trigger 关键词就是为了实现精准激活。

**误区 3**：用 system prompt 注入 skill 更直接  
→ 直接，但破坏了 prompt cache。Hermes 的 user message 注入方案是在"效果"和"成本"之间取得的平衡。
