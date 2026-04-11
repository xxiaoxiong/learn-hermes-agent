# h08a — Skill Injection Boundary: Why Skills Are Operating Guides, Not Extensions of the System Prompt

> This page extends `h08`. The main chapter explained why skills are injected via user messages; this bridge doc pushes the boundary further: **skills, system prompts, memory, and plugins all appear to "influence agent behavior," but they operate at completely different levels.**

---

## The Bottom Line

A skill's most accurate positioning is not "another layer of personality" or "making system rules longer."

It's more like:

**A task-specific operating guide that's temporarily loaded for a certain category of work.**

So a skill's most important boundary isn't that it's written in markdown, but:

- It's activated per task
- It will be switched out
- It should not pollute the high-stability system prompt body

---

## 1. Why Skills Are Most Easily Mistaken for System Prompt Extensions

On the surface, skills also contain rules: what to do, what order, what pitfalls to avoid. And doesn't the system prompt also contain rules?

So the most natural misconception is:

> Aren't skills just the supplementary rules that weren't written into the system prompt?

The problem with this thinking is that it only sees "both are textual instructions" without seeing that their **lifecycle and stability** are completely different.

---

## 2. System Prompt Governs Long-term, High-priority Behavioral Boundaries

The system prompt is like the agent's foundational operating constitution. It typically covers: role identity, safety boundaries, collaboration style, tool usage principles, output style constraints.

These contents are characterized by:

- Long-term stability
- Applicable to the vast majority of tasks
- Should not be drastically rewritten just because the current turn's topic changed

Skills are the exact opposite:

- Often only useful for certain task categories
- Switch as tasks change
- Emphasize "how to do this type of thing," not "who you are"

---

## 3. Skills and Memory Are Also Not the Same Thing

Another common confusion is treating skills as memory. But the key difference is clear:

- Memory stores state, preferences, long-term facts
- Skills store methods, steps, operational advice

For example:

- "User prefers concise answers" → memory
- "When doing code reviews, prioritize security and boundary conditions" → skill

One answers "what do I remember," the other answers "how should I do this."

---

## 4. Skills and Plugins Also Cannot Be Mixed

If you also see skills and plugins as the same category, architectural confusion worsens.

Plugins extend: tools, hooks, commands, provider interfaces — real capability interfaces.

Skills extend: behavioral guidance for certain task categories — supplements for steps, checklists, and precautions.

So plugins are more like "adding hands and feet to the agent," while skills are more like "giving the agent a task briefing for the current assignment."

---

## 5. Why User Message Injection Precisely Reflects This Boundary

Hermes doesn't put skills in the system prompt but on the user message side. This directly reflects their positioning:

- System prompt: high stability, long-term validity
- User message: current-task-related, can change per turn

Skills entering via user message isn't just for prompt caching; it also semantically states:

> This is supplemental guidance within the current task context, not part of the agent's core identity.

This semantic layer matters. Once you merge skills into the system prompt, the architecture starts misleading you — as if these task instructions also belong to the agent's permanent personality settings.

---

## 6. A Useful Decision Rule: Should This Rule "Almost Always Be Present"?

### If the answer is "almost always"

Examples: follow safety rules, be transparent when collaborating, read context before using tools.

→ More like system prompt.

### If the answer is "only especially valuable for certain task categories"

Examples: follow ref lifecycle for browser automation, unpack-edit-pack for docx, follow a fixed checklist for code reviews.

→ More like a skill.

---

## 7. Why Prompt Structure Also Becomes More Stable Once Skill Boundaries Are Clear

Once you treat skills as "task-specific operating guides," many design decisions naturally clarify:

- They don't need to permanently reside in the system prompt prefix
- They're suitable for trigger-based activation
- They're suitable for replacement as tasks switch
- They won't compete with memory for the same storage slot

In other words, once the skill boundary is clear, prompt assembly, caching strategy, and the memory system's division of labor all smooth out together.

---

## 8. How This Connects to the Main Chapters

- `h04`: Know that prompts are assembled from sections
- `h04a`: Understand why a stable prefix matters
- `h08`: Understand why skills are injected as user messages
- This page: Further clarify the boundaries between skills, system prompts, memory, and plugins

This way your understanding of skills upgrades from "a markdown file" to "a behavioral guidance module with a clear injection level."

---

## 9. The One Takeaway from This Page

Skills are not system prompt patch packs, nor another way to write long-term memory.

They are switchable operating guides for the current task family — and precisely because of this, they should be designed as an independent injection boundary.
