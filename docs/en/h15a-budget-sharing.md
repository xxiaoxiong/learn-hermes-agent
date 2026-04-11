# h15a — Budget Sharing: Why Subagent's True Constraint Is Shared Budget, Not Concurrency Count

> This page extends `h15`. The main chapter covered `IterationBudget` and context isolation; this bridge doc clarifies another frequently underestimated point: **the key to preventing subagent systems from losing control isn't how many threads you open, but whether parent and child agents share the same budget.**

---

## The Bottom Line

When first seeing subagent delegation, many people focus on: can it run concurrently, how many workers, how fast child agents are.

These all matter, but Hermes' truly more core constraint is:

- Whether child agents consume the parent agent's iteration budget
- Whether the entire task tree is controlled by the same upper limit

Because without shared budget, even the most elegant concurrency implementation may just spread loss of control faster.

---

## 1. Why "Giving Each Child Agent Its Own Budget" Seems Reasonable

Intuitively, it seems more independent: parent gets 50 iterations, child A gets 50 more, child B gets 50 more.

But the problem is right here:

- The parent can inflate a single task into multiples of the cost by constantly delegating
- Each child agent could potentially spawn more child agents
- Total iterations lose their global cap

Without shared budget, "delegation" becomes a backdoor for bypassing total resource limits.

---

## 2. Shared Budget Sets a Cap for the "Entire Task Tree"

Hermes' budget design limits not a single agent but:

> From the parent task onward, the entire delegation tree can consume at most N total iterations.

This means:

- Parent agent takes one more step → costs budget
- Child agent takes one more step → costs the same pool
- Grandchild agents nested further down → still cost the same pool

So `IterationBudget` isn't an instance-level quota — it's a task-tree-level quota.

---

## 3. Why Concurrency Isn't Core — Isolation and Constraints Are

Concurrency has value: multiple subtasks progress simultaneously, total time is shorter.

But concurrency isn't the soul of subagent architecture. Hermes cares more about two things:

- **Context isolation**: Subtasks have clean workspaces
- **Budget sharing**: Subtasks can't bypass global cost constraints

With only concurrency but without these two, you get something more like a batch of casually parallelized LLM calls, not a governable subagent system.

---

## 4. Why Shared Budget and Context Isolation Must Coexist

These two are a pair:

- Isolation prevents context cross-pollution
- Budget sharing prevents unlimited resource expansion

Only isolation without budget sharing: child agents are clean but can expand infinitely. Only budget sharing without isolation: total cost is controlled but subtasks and parent tasks fight in the same messages.

So Hermes' delegation simultaneously answers two questions: where does the subtask work (isolation), and whose budget does it spend (shared).

---

## 5. Why Error Handling Is Also Affected by the Budget Model

When a child agent fails, the parent can often still judge: retry, skip, or change strategy.

But there's a prerequisite: all these recovery actions still draw from the same budget pool.

Shared budget limits not just "normal progress" but also "post-failure recovery chains." This prevents the system from losing control through endlessly retrying subtasks.

So the budget model isn't just performance control — it's also the boundary condition for error recovery.

---

## 6. A Useful Decision Rule: Is Delegation Splitting Work or Bypassing Limits?

### If it's splitting work

- Subtask context is independent
- Cost still goes on the same total ledger
- Parent task is responsible for delegation actions

→ Healthy delegation.

### If it's bypassing limits

- Subtasks get new independent budget pools
- Recursive delegation causes total cost to expand infinitely
- Parent appears to make only 1 call but actually consumed many times the resources behind the scenes

→ Not delegation — resource escape.

This question almost directly determines whether the architecture is sound.

---

## 7. Why This Page Connects to Error Recovery / Cron

Once you see budget sharing as "total task tree constraint," many chapters connect:

- If a cron job triggers subagents, it must follow the same budget thinking
- Retry / continuation in error recovery also continues consuming budget
- Provider fallback doesn't bypass budget — it just switches the execution path

This shows budget isn't a delegation-private concept — it's a universal constraint language for the entire agent runtime.

---

## 8. How This Connects to the Main Chapters

- `h13`: See that automated tasks also trigger complete agent workflows
- `h15`: Understand subagent context isolation and concurrent execution
- This page: See that the key to preventing system runaway is budget sharing, not thread count
- `h16`: Then see provider runtime and fallback — you'll more easily realize all execution paths should ultimately be constrained by the same task cost

---

## 9. The One Takeaway from This Page

The key to preventing subagent system runaway isn't limiting how many concurrent workers can be opened, but ensuring all parent and child agents share the same task budget.

Context can be isolated, but cost cannot escape — this is the most critical line in Hermes' delegation design.
