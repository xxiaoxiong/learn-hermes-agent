# h13a — Agentic Cron: Why Scheduled Tasks in Hermes Are Agent Triggers, Not Script Schedulers

> This page extends `h13`. The main chapter explained that cron jobs launch fresh `AIAgent` instances; this bridge doc pushes the design one step further: **Hermes' cron doesn't just "execute tasks on a schedule" — it "triggers a complete agent execution on a schedule."**

---

## The Bottom Line

Traditional cron: arrive on time → run a script → done.

Hermes' cron: arrive on time → generate a fresh task context → trigger a complete agent loop → deliver results to the designated channel.

This means Hermes' cron isn't a regular scheduler with an LLM wrapper — it turns "scheduled triggering" into an entry type for the agent runtime.

---

## 1. Why "Script-style Cron" Can't Express What Hermes Does

Shell script scheduling focuses on: fixed commands, fixed sequence, exceptions handled by the script author's foresight.

But Hermes' cron jobs don't pre-write command sequences. Instead, they give the agent a goal and let it decide at runtime:

- Whether tools need to be called
- What order to proceed in
- How to adjust strategy when encountering exceptions
- How to summarize and deliver results

So it's not just automation — it's **scheduled agency**.

---

## 2. Why Fresh Agent Is Core Design, Not Implementation Detail

If cron tasks reused the user's current conversation session, many forms of pollution would occur:

- Daytime mid-conversation context mixing into overnight automated tasks
- Automated task execution details crowding out human conversation context
- Scheduled jobs leaking history to each other

Hermes chooses fresh `AIAgent` not because it's "more convenient" but because it's making something explicit:

> Each cron trigger is a new workflow, not a natural continuation of an old conversation.

This shares the same architectural philosophy as session routing in gateway: different event sources should have clear context boundaries.

---

## 3. Why `skill_attachment` Turns Cron from "Script" to "Task Executor"

With `skill_attachment`, a cron job is no longer just a prompt string. It becomes:

- A task objective
- Plus a domain-specific operating guide

This is crucial because it gives the cron job not just "what to do" but "how to do it."

For example: for the same daily report task, with a `git-reporter` skill attached, output is organized by commits, change scope, and author distribution; without the skill, the agent can only rely on general capabilities to judge on the fly.

So skill attachment upgrades cron from "scheduled question asker" to "scheduled agent executor."

---

## 4. Why the Delivery Layer Makes Cron Truly Part of Hermes Runtime

If cron results could only be written to logs, it would still feel like a traditional background task.

But Hermes delivers results back to Telegram, CLI, and other platforms. This means cron isn't just background execution — it's part of Hermes' overall interaction system. It shares the delivery layer with gateway, meaning:

- Real-time message entry can trigger agents
- Scheduled entry can also trigger agents
- Both ultimately feed into unified delivery capabilities

This makes cron not a peripheral module but an official entry point of the runtime.

---

## 5. Why Cron and Gateway Should Be on the Same Architecture Diagram

Many systems treat cron as an ancillary feature and gateway as the main system. But in Hermes, they're more like parallel entry points:

| Entry Type | Trigger Method | Typical Source |
|---|---|---|
| Gateway | External real-time messages | Telegram / Discord / CLI |
| Cron | Time-triggered | scheduler tick |

Both ultimately: generate task context, create or select agent session boundaries, enter the agent loop, and deliver results through the delivery layer.

From this perspective, cron is more like an event source, not just a timer.

---

## 6. A Useful Decision Rule: Are You Scheduling a Command or an Agent Decision Process?

### If you're scheduling a command

Steps are known, sequence is fixed, almost no on-the-fly decisions needed.

→ More like traditional cron scripts.

### If you're scheduling an agent decision process

Only the goal is given, full process isn't pre-written, tool calls and dynamic branching are allowed, results still need platform delivery.

→ More like Hermes-style agentic cron.

This question quickly distinguishes "script automation" from "agent automation."

---

## 7. Why This Page Also Connects to Subagent / Provider Runtime

Once you see cron as an agent entry point, it naturally links to later chapters:

- May use subagent delegation to split subtasks
- May trigger provider fallback and error recovery
- May rely on skill injection to improve task execution quality

This shows cron isn't a closed subsystem — it **re-invokes most of Hermes' runtime capabilities in a "time-driven" scenario.**

---

## 8. How This Connects to the Main Chapters

- `h12`: Understand how real-time events enter the agent
- `h13`: Understand how the scheduler triggers tasks on time
- This page: See that cron in Hermes is actually another agent entry point, not an ordinary background script
- `h15`: Continue to see that automated tasks can internally spawn sub-agents

This upgrades your understanding of cron from "scheduled execution" to "scheduled triggering of a complete agent workflow."

---

## 9. The One Takeaway from This Page

Hermes' cron doesn't schedule pre-written commands on a timer — it triggers a complete agent execution process that can call tools, use skills, and deliver results on a schedule.

This is why it's more like an agent trigger than a script scheduler.
