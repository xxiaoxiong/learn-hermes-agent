# h04 — Prompt Assembly：5 层 section 按优先级动态组装 system prompt

> **核心洞察**：system prompt 不是一次性写死的字符串——它是运行时根据文件和状态动态构建的，每层 section 有独立的优先级和条件。

---

## 问题：为什么不能用一个固定字符串？

如果 system prompt 是硬编码的：

```python
SYSTEM_PROMPT = """你是 Hermes，一个 AI 助手。
你有如下工具：...
记忆：...
技能：...
"""
```

面临的问题：

1. **记忆更新困难**：每次用户让 agent 记住新信息，都要修改字符串
2. **技能无法动态加载**：不同任务需要不同的 skill，固定字符串做不到
3. **条件渲染缺失**：`SOUL.md` 存在时才加载个性，不存在时跳过
4. **prompt caching 失效**：Anthropic 的 prompt caching 要求 prompt 的前缀固定。如果把动态内容（如时间、随机信息）放在前面，会导致 cache miss

---

## 解决方案：PromptBuilder

```python
@dataclass
class PromptSection:
    name: str
    content: str
    priority: int        # 数字越小，优先级越高，排在越前面
    condition: bool = True  # False 时跳过这个 section

class PromptBuilder:
    def __init__(self):
        self._sections: list[PromptSection] = []

    def add_section(self, name: str, content: str, priority: int = 50,
                    condition: bool = True) -> "PromptBuilder":
        if condition and content.strip():
            self._sections.append(PromptSection(name, content, priority))
        return self  # 支持链式调用

    def build(self) -> str:
        """按 priority 排序，拼接所有 section"""
        sorted_sections = sorted(self._sections, key=lambda s: s.priority)
        parts = []
        for section in sorted_sections:
            parts.append(f"## {section.name}\n{section.content}")
        return "\n\n".join(parts)
```

---

## 5 类 Section 与优先级

Hermes 的 `prompt_builder.py` 使用 5 类 section：

| 优先级 | Section 名 | 来源 | 说明 |
|---|---|---|---|
| 10 | personality | `SOUL.md` | agent 的核心人格，最稳定，放最前面 |
| 20 | memory | `MEMORY.md` + `USER.md` | 跨会话记忆，相对稳定 |
| 30 | skills | `.hermes/skills/` 目录 | 任务相关技能，按需加载 |
| 40 | context_files | 当前工作目录中的上下文文件 | 最可能变化，放中间 |
| 50 | tool_guidance | 工具使用指南 | 固定格式，放最后 |

**为什么优先级顺序重要？**

Anthropic 的 prompt caching 以 `1024 token` 为边界缓存前缀。`personality` 内容最稳定，放最前面，可以被 cache 住。频繁变化的 `context_files` 放后面，不影响前面内容的 cache。

---

## 代码示例：动态构建 system prompt

```python
def build_system_prompt(
    soul_file: str = "SOUL.md",
    memory_file: str = "MEMORY.md",
    skills_dir: str = ".hermes/skills/",
) -> str:
    builder = PromptBuilder()

    # 人格层：文件存在才加载
    soul_content = _read_file_safe(soul_file)
    builder.add_section(
        "Personality",
        soul_content,
        priority=10,
        condition=bool(soul_content),  # ← 文件不存在时跳过
    )

    # 记忆层：从 MEMORY.md 读取
    memory_content = _read_file_safe(memory_file)
    builder.add_section("Memory", memory_content, priority=20,
                        condition=bool(memory_content))

    # 技能层：扫描 skills 目录
    skills_content = _load_skills(skills_dir)
    builder.add_section("Available Skills", skills_content, priority=30,
                        condition=bool(skills_content))

    # 工具使用指南：始终存在
    builder.add_section("Tool Usage", TOOL_GUIDANCE_TEXT, priority=50)

    return builder.build()
```

---

## condition 控制的意义

```python
# SOUL.md 存在时：
prompt = "## Personality\n你是 Hermes...\n\n## Tool Usage\n..."

# SOUL.md 不存在时：
prompt = "## Tool Usage\n..."
```

这个简单的 `condition` 机制让 prompt 的组装完全数据驱动：**哪个文件存在，哪个 section 就出现**。运营者可以通过删除/添加文件来修改 agent 行为，无需改代码。

---

## 与 Hermes 真实代码的对应

| 教学实现 | Hermes 源码 | 说明 |
|---|---|---|
| `PromptSection` | `PromptSection` dataclass | 结构相同 |
| `PromptBuilder.add_section()` | `PromptBuilder.add_section()` | 接口一致 |
| `PromptBuilder.build()` | `PromptBuilder.build()` | 相同的排序和拼接逻辑 |
| 5 类 section | 同样的 5 类，但更丰富 | Hermes 还有 `context_compression_notice` 等额外 section |

---

## Bridge：为什么 skill 不放在 system prompt？

h08 会详细解释：Hermes 的 skill 不在 `system prompt` 里注入，而是用 `user message` 注入。这样做的原因正是 prompt caching：

- system prompt 的 `personality` + `memory` 部分相对稳定，可以被 cache
- 如果把 skill 内容放进 system prompt，每次加载不同 skill 就会破坏 cache
- 改用 user message 注入 skill，system prompt 保持不变，cache 命中率更高

---

## 常见误区

**误区 1**：priority 越高（数字大）越重要  
→ 数字越小，排在越前面（priority=10 在 priority=50 之前）。Hermes 把最重要、最稳定的内容放在 prompt 最前面，以优化 cache。

**误区 2**：condition=False 的 section 会输出空内容  
→ 不会。`condition=False` 的 section 直接跳过，`build()` 的输出里不会出现它。

**误区 3**：prompt 越长越好  
→ 过长的 prompt 消耗更多 token，并可能影响模型对关键指令的注意力。Hermes 的 section 设计就是为了只在需要时才加载对应内容。

---

## 动手练习

1. 运行 `python agents/h04_prompt_assembly.py`，观察有无 `SOUL.md` 时 prompt 输出的差异
2. 添加一个新的 `section`（比如 "Current Date"），设置 `priority=15`，观察它出现在 prompt 的位置
3. 修改 `TOOL_GUIDANCE_TEXT`，给工具使用添加一条规则，验证模型行为是否跟随变化
