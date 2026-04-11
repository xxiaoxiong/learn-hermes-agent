# h08 — Skills System: Skill Injection as User Messages to Preserve Prompt Cache

> **Core Insight**: A skill is an operating guide, not a persona definition — injecting it as a user message avoids breaking the system prompt's cache hit rate.

---

## The Problem: How to Give the Agent Domain-Specific Operating Standards?

Some knowledge doesn't belong in `MEMORY.md` (which stores state, not operating standards), nor should it be hard-coded into the system prompt (too long and cluttered).

For example:
- "When working with Python code, always follow PEP8 and use type annotations"
- "When analyzing data, check for missing values first, then run statistics"
- "During code review, focus on these 5 dimensions: …"

These are **operating guides** (How to do), not identity definitions (Who you are).

---

## Skill File Format

A skill is a markdown file with YAML frontmatter:

```markdown
---
name: python-expert
description: Python code writing and review expert mode
trigger: python|code|script
---

## Python Code Standards

When working with Python code, follow these standards:

1. **Type annotations**: All function parameters and return values should have type annotations
2. **Docstrings**: Use Google-style docstrings
3. **Error handling**: Use specific exception types, never bare `except:`
4. **Test first**: Write tests before complex logic

## Code Review Checklist

- [ ] Are there unhandled None values?
- [ ] Are there magic numbers (should be extracted as constants)?
- [ ] Are exceptions properly propagated?
```

---

## Skill Discovery: Two Scan Locations

```python
def discover_skills(project_dir: str = ".") -> list[SkillFile]:
    """
    Scan two locations for skill files:
    1. Project-level: .hermes/skills/ (higher priority)
    2. User-level: ~/.hermes/skills/ (global defaults)
    """
    skills = []

    # Project-level skills (override user-level skills with the same name)
    project_skills_dir = os.path.join(project_dir, ".hermes", "skills")
    if os.path.isdir(project_skills_dir):
        skills.extend(_load_dir(project_skills_dir))

    # User-level skills
    user_skills_dir = os.path.expanduser("~/.hermes/skills")
    if os.path.isdir(user_skills_dir):
        existing_names = {s.name for s in skills}
        for skill in _load_dir(user_skills_dir):
            if skill.name not in existing_names:  # Don't override project-level
                skills.append(skill)

    return skills
```

---

## Why Inject as User Message Instead of System Prompt?

This is the most critical design decision in h08.

### Option A: Inject into system prompt (the intuitive approach)

```python
# ❌ Each time a different skill is loaded, the system prompt changes
system_prompt = build_system_prompt() + "\n\n" + skill.content
```

Problem: Anthropic's prompt caching caches by fixed prefix. If different requests have different system prompts, every cache misses and each request must be recomputed — doubling cost.

### Option B: Inject as user message (Hermes' choice)

```python
# ✅ System prompt stays unchanged; skill is injected as a user message
messages = [
    {
        "role": "user",
        "content": f"[Skill: {skill.name}]\n\n{skill.content}\n\n---\n\n{actual_user_message}"
    }
]
```

The system prompt (personality + memory + tool_guidance) remains identical, so the prefix cache hits. Skill content only affects the first user message of the current conversation, without impacting the cache.

---

## Trigger Mechanism

Skills can be activated in two ways:

### 1. Auto-trigger (based on trigger keywords in frontmatter)

```python
def match_skills(user_message: str, skills: list[SkillFile]) -> list[SkillFile]:
    """Check if the user message matches a skill's trigger regex"""
    matched = []
    for skill in skills:
        if skill.trigger and re.search(skill.trigger, user_message, re.IGNORECASE):
            matched.append(skill)
    return matched
```

### 2. Manual trigger (slash command)

```
/skill python-expert
```

`/skill` is a CLI command (h11) that directly activates the specified skill.

---

## Skill vs Memory: The Boundary

| | Skill | Memory |
|---|---|---|
| Content | Operating guide (How to do) | State record (What happened) |
| File | `.hermes/skills/*.md` | `MEMORY.md`, `USER.md` |
| Injection method | user message | system prompt (memory section) |
| Lifecycle | Within session | Persistent across sessions |
| Update frequency | Manually maintained | Agent writes automatically |

---

## Code Walkthrough: snippets/h08_skills_system.py

The Code tab for this chapter shows curated snippets from `agent/skill_commands.py`, focusing on:

1. **`SkillFile` dataclass** — Frontmatter parsing and the trigger field
2. **`discover_skills()`** — Dual-path scanning logic
3. **Injection point** — How skill content is concatenated into the first user message

---

## Common Misconceptions

**Misconception 1**: Skills and SOUL.md are the same kind of thing  
→ SOUL.md is the persona (the personality section of system prompt), part of the agent's identity, always present. A skill is an operating guide for a specific task, activated on demand.

**Misconception 2**: You can load all skills at once  
→ Skill content consumes tokens. Only activating skills relevant to the current task is the right approach. Trigger keywords exist precisely for precise activation.

**Misconception 3**: Injecting skills via system prompt is more straightforward  
→ Straightforward, but it breaks prompt cache. Hermes' user message injection approach strikes a balance between "effectiveness" and "cost."
