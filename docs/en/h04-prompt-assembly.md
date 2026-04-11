# h04 — Prompt Assembly: 5-Tier Section Dynamic System Prompt Construction

> **Core Insight**: The system prompt is not a hard-coded string — it is dynamically assembled at runtime from files and state, with each section having its own priority and condition.

---

## The Problem: Why Can't You Use a Fixed String?

If the system prompt is hard-coded:

```python
SYSTEM_PROMPT = """You are Hermes, an AI assistant.
You have the following tools: ...
Memory: ...
Skills: ...
"""
```

The problems you face:

1. **Difficult to update memory**: Every time the user asks the agent to remember something, you have to modify the string
2. **Cannot dynamically load skills**: Different tasks need different skills; a fixed string cannot handle this
3. **No conditional rendering**: `SOUL.md` should only be loaded if it exists; otherwise skip
4. **Prompt caching breaks**: Anthropic's prompt caching caches prefixes at `1024 token` boundaries. Putting dynamic content (time, random info) at the front causes cache misses

---

## The Solution: PromptBuilder

```python
@dataclass
class PromptSection:
    name: str
    content: str
    priority: int        # Lower number = higher priority, placed earlier
    condition: bool = True  # False → skip this section

class PromptBuilder:
    def __init__(self):
        self._sections: list[PromptSection] = []

    def add_section(self, name: str, content: str, priority: int = 50,
                    condition: bool = True) -> "PromptBuilder":
        if condition and content.strip():
            self._sections.append(PromptSection(name, content, priority))
        return self  # Supports chaining

    def build(self) -> str:
        """Sort by priority and concatenate all sections"""
        sorted_sections = sorted(self._sections, key=lambda s: s.priority)
        parts = []
        for section in sorted_sections:
            parts.append(f"## {section.name}\n{section.content}")
        return "\n\n".join(parts)
```

---

## 5 Section Types and Their Priorities

Hermes' `prompt_builder.py` uses 5 section types:

| Priority | Section Name | Source | Description |
|---|---|---|---|
| 10 | personality | `SOUL.md` | Agent's core persona; most stable, placed first |
| 20 | memory | `MEMORY.md` + `USER.md` | Cross-session memory; relatively stable |
| 30 | skills | `.hermes/skills/` directory | Task-related skills, loaded on demand |
| 40 | context_files | Context files in the current working directory | Most likely to change, placed in the middle |
| 50 | tool_guidance | Tool usage guide | Fixed format, placed last |

**Why does priority order matter?**

Anthropic's prompt caching caches prefixes at `1024 token` boundaries. `personality` is the most stable content and is placed first so it gets cached. Frequently changing `context_files` are placed later so they don't invalidate the cache of preceding content.

---

## Code Example: Dynamic System Prompt Construction

```python
def build_system_prompt(
    soul_file: str = "SOUL.md",
    memory_file: str = "MEMORY.md",
    skills_dir: str = ".hermes/skills/",
) -> str:
    builder = PromptBuilder()

    # Personality layer: only load if the file exists
    soul_content = _read_file_safe(soul_file)
    builder.add_section(
        "Personality",
        soul_content,
        priority=10,
        condition=bool(soul_content),  # ← skip if file doesn't exist
    )

    # Memory layer: read from MEMORY.md
    memory_content = _read_file_safe(memory_file)
    builder.add_section("Memory", memory_content, priority=20,
                        condition=bool(memory_content))

    # Skills layer: scan the skills directory
    skills_content = _load_skills(skills_dir)
    builder.add_section("Available Skills", skills_content, priority=30,
                        condition=bool(skills_content))

    # Tool usage guide: always present
    builder.add_section("Tool Usage", TOOL_GUIDANCE_TEXT, priority=50)

    return builder.build()
```

---

## The Significance of Condition Control

```python
# When SOUL.md exists:
prompt = "## Personality\nYou are Hermes...\n\n## Tool Usage\n..."

# When SOUL.md doesn't exist:
prompt = "## Tool Usage\n..."
```

This simple `condition` mechanism makes prompt assembly fully data-driven: **whichever file exists, that section appears**. Operators can modify agent behavior by adding or removing files, without changing code.

---

## Mapping to Real Hermes Code

| Teaching Implementation | Hermes Source | Notes |
|---|---|---|
| `PromptSection` | `PromptSection` dataclass | Same structure |
| `PromptBuilder.add_section()` | `PromptBuilder.add_section()` | Same interface |
| `PromptBuilder.build()` | `PromptBuilder.build()` | Same sort-and-concatenate logic |
| 5 section types | Same 5 types, but richer | Hermes also has `context_compression_notice` and other extra sections |

---

## Bridge: Why Aren't Skills Placed in the System Prompt?

Chapter h08 explains in detail: Hermes injects skills via `user message` rather than `system prompt`. The reason is precisely prompt caching:

- The `personality` + `memory` portions of system prompt are relatively stable and can be cached
- If skill content were placed in system prompt, loading different skills would break the cache
- Using user message injection for skills keeps the system prompt unchanged, improving cache hit rate

---

## Common Misconceptions

**Misconception 1**: Higher priority number = more important  
→ Lower numbers are placed earlier (priority=10 comes before priority=50). Hermes places the most important, most stable content at the front of the prompt to optimize caching.

**Misconception 2**: Sections with condition=False output empty content  
→ They don't. Sections with `condition=False` are skipped entirely; `build()` output will not contain them.

**Misconception 3**: Longer prompts are always better  
→ Overly long prompts consume more tokens and may dilute the model's attention to key instructions. Hermes' section design is specifically for loading content only when needed.

---

## Hands-On Exercises

1. Run `python agents/h04_prompt_assembly.py` and observe the difference in prompt output with and without `SOUL.md`
2. Add a new section (e.g., "Current Date") with `priority=15` and observe where it appears in the prompt
3. Modify `TOOL_GUIDANCE_TEXT` to add a rule for tool usage and verify whether the model's behavior follows the change
