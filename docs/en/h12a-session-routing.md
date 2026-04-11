# h12a — Session Routing: Why Gateway's Real Challenge Isn't Connecting Platforms but Isolating Sessions

> This page extends `h12`. The main chapter introduced `GatewayRunner` and `MessageEvent`; this bridge doc highlights the real architectural challenge: **the core difficulty of Gateway isn't receiving messages but stably routing each message to the correct session context.**

---

## The Bottom Line

When first looking at gateway, many people focus on: how to connect Telegram, Discord, or handle webhooks/SDKs.

These matter, but Hermes' truly more critical challenge is:

- Which message enters which session
- Whether the same person shares context across platforms
- Whether different chats on the same platform should be isolated
- Whether automated tasks, DMs, and group chats should reuse the same agent

In other words, gateway isn't simply "routing messages into an agent" — it's first and foremost a **session routing system**.

---

## 1. Why Connecting Platforms Is Relatively Easy While Session Routing Is Harder

Platform integration is fundamentally an adapter problem: convert platform events to a unified structure, send replies back. Tedious but directionally clear.

The routing layer is where errors more easily occur, because it concerns context pollution:

- Two conversations that should be independent get mixed together
- One continuous conversation gets split apart
- Group and private chats accidentally share the same session

Once routing is wrong, no matter how smart the agent is, it answers in the wrong context.

---

## 2. `platform + user + chat` Isn't Arbitrary Concatenation — It Defines Context Boundaries

The session key shape from `h12` looks like an implementation detail: `telegram:user:chat`, `discord:user:channel`.

But it actually expresses something very important:

> Context doesn't just belong to "a user" — it belongs to "a user's ongoing interaction within a specific platform and conversation space."

This means:

- The same user on Telegram and Discord doesn't automatically share context
- The same user in different groups/DMs on the same platform doesn't necessarily share context
- "Who said what where" determines context ownership

So session keys aren't concatenation tricks — they're the encoded form of context isolation strategy.

---

## 3. Why Using Only `user_id` Will Almost Certainly Go Wrong

Using only `user_id` looks simplest but is extremely risky. For example, the same user:

- In a DM asks the agent to write a daily report
- In a group chat asks a public question

If routed only by `user_id`, these two threads merge into one session:

- Group chat context leaks into the DM
- DM context leaks into the group chat
- The agent starts exhibiting misplaced behavior: "I remember you just said in another place…"

So Gateway routing is never simple identity recognition — it's context boundary delineation.

---

## 4. Why DM Pairing Also Belongs to the Routing System

DM pairing looks like just security authorization on the surface. But it also affects the routing model because it answers:

- Which message sources should be allowed to enter the agent loop
- Which user_ids can establish valid sessions
- Whether a DM on a platform is considered a trusted context space

Pairing isn't just "whether usage is allowed" — it also determines which entry points get incorporated into the formal session routing system.

---

## 5. Why This Page Also Relates to Cron / Background Tasks

Once you see routing as "finding the correct context for each event," cron naturally enters the same picture.

Because cron tasks also need to answer: which session space they belong to, whether they should always be fresh agents, and whether they should share context with the user's daily conversations.

Hermes' answer for cron is typically: fresh agent, independent context, no pollution of user daily sessions. This is just another kind of session routing decision.

So: gateway handles routing for external real-time events; cron handles routing for scheduled background events. Both share the same architectural problem.

---

## 6. A Useful Decision Rule: Is This Event "A Continuation of the Same Conversation" or "A Separate Independent Workflow"?

### If it's a continuation of the same conversation

E.g., supplementary messages from the same platform, same chat, same user sent consecutively.

→ More suitable to reuse the original session.

### If it's a separate independent workflow

E.g., different platform source, different chat space, cron-triggered background task, automated processing requiring fresh context.

→ More suitable to create or isolate a new session.

This judgment is far more reliable than "is it the same user."

---

## 7. Why GatewayRunner's Real Value Is "Making AIAgent Unaware That Platforms Exist"

Once session routing is done correctly, AIAgent can stay very pure:

- It only sees text and the current session context
- It doesn't care whether the message came from Telegram or Discord
- It's not responsible for deciding whether group chats, DMs, and scheduled tasks should share history

This shows GatewayRunner's essence is not just an adapter container but:

**Blocking platform differences and session boundary problems from reaching the agent.**

This lets AIAgent focus on the agent loop rather than bearing platform state machines.

---

## 8. How This Connects to the Main Chapters

- `h11`: Understand how commands are unified routing
- `h12`: Understand how platform messages are unified into `MessageEvent`
- This page: Understand that gateway's true difficulty is session routing, not the adapter itself
- `h13`: Continue to see how scheduled tasks follow a different context routing logic

This upgrades `Gateway System` in your mind from "multi-platform access layer" to "multi-source event context routing layer."

---

## 9. The One Takeaway from This Page

Gateway's core isn't connecting different platforms — it's ensuring every message entering the system stably lands within the correct session boundary.

Platform adaptation is just the entry point; session routing is the true architectural center.
