# h09a — Approval Pipeline: Why the Permission System Must Live at the Dispatch Layer, Not Inside Tools

> This page extends `h09`. The main chapter gave the deny → check → allow → ask four-stage pipeline; this bridge doc addresses a more fundamental question: **why Hermes places permission judgment at the tool dispatch layer rather than letting each tool decide what's dangerous on its own.**

---

## The Bottom Line

What the permission system truly needs to unify isn't just a "dangerous commands list" but:

- Detection timing
- Interception ordering
- How allow / ask / deny decisions are made
- How approval results feed into the subsequent execution chain

Once these are scattered inside individual tools, it becomes nearly impossible to keep them consistent.

So Hermes' key design isn't "having approval logic" but:

**Approval logic lives at the dispatch layer, before all tools actually execute.**

---

## 1. Why "Each Tool Checks Itself" Seems Natural

From a local implementation perspective, this approach is tempting:

- `bash` checks for dangerous shell commands itself
- `write_file` checks for sensitive paths itself
- `network` checks for dangerous domains itself

Each tool seemingly knows its own risks best. But once the system grows, problems quickly appear:

- Rules are scattered across different files
- Same risk has inconsistent standards across tools
- New tools easily forget to add permission logic
- The user-facing approval experience becomes inconsistent

It's locally convenient but systematically loses control.

---

## 2. The Dispatch Layer's Meaning: Judge First, Then Delegate

Hermes places approval before dispatch, insisting on an order:

1. First determine whether this call is allowed
2. Then decide which tool handler actually executes

Benefits:

- All tools share the same entry point
- All danger detection shares the same timing
- Approval results don't depend on whether a particular tool author thought things through

Safety boundaries are maintained by the system uniformly, not by individual tools.

---

## 3. The Permission System Unifies the Decision Process, Not Just Risk Content

Many people see approval as a set of dangerous regexes. But what's truly more important is the decision process itself:

- Which cases get hard-rejected first
- Which get intercepted in check mode
- Which pass automatically via the allowlist
- Which require asking the user

This is why `deny → check → allow → ask` matters more than "writing a few dangerous command rules." Rules can keep growing, but if the process isn't unified, system behavior remains unstable.

---

## 4. Why `ask` Must Be System-level, Not Tool-private

If each tool decides whether to confirm with the user:

- `bash` pops one style of confirmation
- `write_file` shows a different prompt
- `network` doesn't ask at all and just proceeds

Users face not a single permission system but multiple inconsistently styled mini-approvers.

Hermes designs `ask` as a unified callback, solving exactly this: who asks is determined by environment (CLI / Gateway), when to ask is determined by the unified pipeline, and the result feeds into execution through the dispatch layer.

So `ask` isn't some tool's UI — it's part of the entire agent runtime.

---

## 5. Why the Allowlist Should Also Be Maintained at the Dispatch Layer

If the allowlist is inside tools, two problems arise:

- The same "safe rule" can't be reused across tools
- It's hard to know what the system as a whole defaults to allowing

At the dispatch layer, the allowlist becomes global policy:

- Which operations are trusted by default
- Which must go through confirmation
- Which are never allowed regardless

This upgrades the permission system from "tool-local judgment" to "runtime-global policy."

---

## 6. A Useful Decision Rule: Is This Logic Describing Tool Implementation or System Boundaries?

### If it describes how the tool works

Examples: how `write_file` writes content, how `bash` executes commands, how `network` sends requests.

→ Belongs inside the tool.

### If it describes what the system allows or doesn't allow

Examples: which paths can't be written to, which commands require approval, which situations allow automatic pass-through.

→ Belongs at the dispatch layer.

---

## 7. Why This Page Also Relates to Agent-level Tools

Though approval handles normal tool calls, it shares a larger theme with `h03a-agent-level-tools`:

> Hermes cares deeply about the boundary between "control plane" and "execution plane."

- Agent-level tools keep internal state capabilities on the control plane
- The approval pipeline keeps permission judgment on the control plane
- Normal handlers focus on the execution plane

So this bridge doc really helps you see: Hermes isn't a system with features piled up — it deliberately preserves a "control first, execute second" architectural division in many places.

---

## 8. How This Connects to the Main Chapters

- `h03`: Understand that some capabilities are intercepted before dispatch
- `h09`: Understand that all normal tool calls go through unified approval before actual execution
- This page: Place both "intercept before execute" designs on the same architectural diagram

You'll more easily discover that many of Hermes' key stability designs live not inside handlers, but before them.

---

## 9. The One Takeaway from This Page

The permission system isn't about "adding a little safety check to tools" — it's about having the runtime make a unified decision before all tool execution about whether this call should happen at all.

This is why the approval pipeline must live at the dispatch layer, not scattered across individual tools.
