# h03a — Agent-level Tools: Why Some Tools Shouldn't Go Through the Normal Registry

> This page extends `h03`. The main chapter told you that `todo` is intercepted first in the main loop; this bridge doc explains the design further: **why some tools are not just "callable capabilities" but integral parts of the agent's own control plane.**

---

## The Bottom Line

Not all tools belong to the same layer.

Hermes has at least two categories:

- **Normal tools**: Act on the external world — files, shell, network
- **Agent-level tools**: Act on the agent's own internal state, memory, or history retrieval capabilities

If you force the latter into the normal `ToolRegistry.dispatch()`, the system looks more "unified" on the surface, but control boundaries become blurred, and the agent's ability to manage its own state degrades.

---

## 1. Normal Tools Modify the External World; Agent-level Tools Modify the Internal Workbench

The most intuitive distinction:

| Type | Typical Examples | What It Modifies |
|---|---|---|
| Normal tools | `read_file`, `write_file`, `bash` | File system, OS, network |
| Agent-level tools | `todo`, `session_search`, `memory_write` | Agent's plans, historical memory, internal retrieval context |

This boundary matters. When `read_file` fails, it affects external task progress; when `todo` fails, it affects the agent's awareness of "where am I in my plan." The latter is not a normal business action — it's part of the control plane.

---

## 2. Why `todo` Is the Clearest Example

The essence of `todo` is not "writing a record to the outside world" but:

- Building a step list
- Updating current execution state
- Maintaining process memory for tasks

In other words, `todo` operates on `PlanState`. And `PlanState` directly influences:

- How the model judges priorities in the next step
- Whether the current task is complete
- Whether a complex goal needs further decomposition

If you make it a regular handler, it still works, but semantically it becomes:

> The agent calls an external service to ask "What does my plan look like now?"

This weakens the agent's self-state management capability.

---

## 3. Why `session_search` Also Resembles an Agent-level Tool

Many people initially think `session_search` is just a regular query tool. But it differs from `read_file` in that:

- It doesn't read an external business resource
- It reads the agent's own past conversation history
- The returned content typically re-enters the current `messages`, influencing subsequent reasoning

So it's more like:

**The agent accessing its own long-term working memory.**

This is why it shares the same architectural flavor as `todo` — both are internal workbench capabilities, not just external I/O.

---

## 4. `memory_write` Is the Same Category of Problem

`memory_write` looks like "writing text to a file" on the surface. But in Hermes' context, it actually:

- Screens out knowledge worth long-term retention from the context
- Writes to `MEMORY.md` / `USER.md`
- Changes future sessions' prompt input

In other words, `memory_write` affects:

- What the agent will remember in the future
- What long-term knowledge gets injected into the system prompt
- Behavioral stability across multiple turns and sessions

It no longer affects some external action in the current turn — it affects the agent's long-term cognitive state.

---

## 5. Why "Everything Through the Registry" Sounds Elegant but Isn't Necessarily Right

Many architectural designs initially chase a goal:

> All tools go through one unified path — the cleanest approach.

This idea isn't wrong, but it depends on what you're unifying.

If you unify:

- The tool descriptions the model sees
- The parsing format for tool calls
- The message shape of return results

This is usually good.

But if you unify to the point where **the control plane and execution plane are no longer distinguished**, problems emerge:

- Plan state gets mistaken for an external side effect
- History retrieval gets mistaken for a normal resource query
- Memory writes get mistaken for regular file operations

The result is a system that's neater on the surface but blurrier at the boundaries.

---

## 6. Three Questions to Determine If a Tool Is Agent-level

### Question 1: Does it primarily modify the external world, or the agent's own state?

- External world → more like a normal tool
- Internal state → more like an agent-level tool

### Question 2: Is its result primarily for the user, or for the agent to continue reasoning?

- For the user → more like a normal tool
- For the agent's own continued reasoning → more like an agent-level tool

### Question 3: If it fails, is the loss a business action or the agent's control capability?

- Business action failure → more like a normal tool
- Control capability impairment → more like an agent-level tool

`todo`, `session_search`, and `memory_write` all lean toward the second answer.

---

## 7. How This Connects to the Main Chapters

This bridge doc hooks back to the main line as follows:

- `h03` introduces you to the **agent-level tool interception** mechanism for the first time
- `h06` shows you that `session_search` depends on SQLite + FTS5
- `h07` shows you that `memory_write` affects the long-term memory layer

So this page doesn't add a new feature — it helps you recalibrate:

> These all look like tools, but architecturally they don't belong to the same layer.

---

## 8. The One Takeaway from This Page

If a tool modifies **the agent's own plans, memory, or history access capabilities**, it's usually not just a regular tool but closer to a control plane capability.

This is also why Hermes deliberately preserves the structure of "the main loop intercepts first, then decides whether to go through the registry" in certain places.
