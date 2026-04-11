# h04a — Prompt Caching: Why a Stable Prefix Matters More Than "Stuffing Everything into the System Prompt"

> This page extends `h04`. The main chapter explained how PromptBuilder assembles prompts into 5-layer sections; this bridge doc addresses another key question: **why Hermes places such emphasis on prompt prefix stability, and why this directly influences the skill injection strategy.**

---

## The Bottom Line

In model pipelines that support prompt caching, the system prompt shouldn't be as flexible as possible — it should aim to:

- Keep the first half stable
- Push high-frequency changing content toward the end
- Avoid polluting the prefix with temporary task instructions

Hermes places `personality` and `memory` (relatively stable content) at the front and more volatile content at the back, with the core goal being:

**Maximize reuse of already-cached prompt prefixes across every request turn.**

---

## 1. What "Cache Hit" Means for Prompts

A simple way to understand it:

- If the first part of each request's prompt is nearly identical
- The model server can reuse previously processed portions
- This reduces redundant computation, lowering latency and cost

Conversely, if you change a large chunk at the very beginning of the prompt every turn, even if the remaining 90% is identical, you may lose caching benefits.

So for models that support caching, prompts aren't just about "semantic correctness" — you also need to care about **structural stability**.

---

## 2. Why the Frontmost Content Is Most Valuable

Sections in PromptBuilder have an order not just for readability. It implies a performance strategy:

- The earlier the section, the more stable it should be
- The later the section, the more it can carry dynamic content

This is why `personality` and `memory` are placed earlier:

- They're relatively stable across multi-turn conversations
- Once cached, they can be reused repeatedly

While things like:

- Current directory context
- Temporary task instructions
- Turn-specific skills

These change frequently. If mixed into the prompt prefix, they'll constantly break cache reuse.

---

## 3. Why "Putting Skills Directly in System Prompt" Is a Dangerous Temptation

Functionally, putting skills in the system prompt works. It even seems natural:

- Aren't skills just rules?
- Shouldn't rules go in the system prompt?

But the problem is that skills are often **task-specific and switch frequently**:

- This time: code review skill
- Next time: browser automation skill
- After that: docx skill

If these contents change the system prompt prefix each time, cache hit rates will quickly degrade.

So Hermes designs skills to be injected via `user message` rather than directly into the system prompt. The effect:

- The system prompt body remains stable
- Skill instructions still enter the current turn's context
- Temporary task methods don't pollute the high-value cache prefix

---

## 4. PromptBuilder's "Order Design" Is Actually Performance Design

In `h04` you see section priority; at runtime it also means another layer:

| Position | Content Type | Goal |
|---|---|---|
| Frontmost | personality | Long-term stable, cache-friendly |
| Front-middle | memory | Relatively stable, cache-friendly |
| Mid-back | skills / context files | More dynamic, pushed back as much as possible |
| Last | tool guidance / other runtime hints | Readability and completeness supplements |

This doesn't mean later content is less important — it means:

**Importance and stability are not the same dimension.**

Content can be very important, but if it changes too frequently, it shouldn't be placed at the very front of the cache prefix.

---

## 5. Why Prompt Caching Feeds Back into Architectural Design

Many people assume caching is just a "deployment optimization detail."

But in a long-running agent system like Hermes, it feeds back into higher-level design, such as:

- How prompt sections are divided
- How memory content is organized
- Whether skills go in system prompt or user messages
- Whether dynamic context is isolated and pushed to the end

In other words, **runtime cost and latency constraints force the prompt architecture itself to become more layered.**

This is why `h04` and `h08` are actually a linked pair:

- `h04` covers structure
- `h08` covers skill injection strategy
- The bridge between them is prompt caching

---

## 6. Don't Mistake "Stable Prefix" for "System Prompt Never Changes"

Hermes doesn't pursue absolute immutability, but rather:

- Keep most high-priority content stable
- Concentrate changes toward the later layers
- Move the most frequently changing instructions to other injection surfaces

This is an engineering approach of "local stability," not a religious "never change anything."

As long as the large blocks at the front of the prefix are sufficiently stable, caching benefits are usually already significant.

---

## 7. When to Suspect Your Prompt Design Is Destroying Cache

Watch out if you see these situations:

- Large amounts of task instructions written into the very front of system prompt every turn
- Skill content frequently replacing the system prompt as tasks switch
- Current working directory, timestamps, and temporary state injected early in the prompt
- Features all work correctly, but request latency and cost remain consistently high

The problem might not be model quality — it might be prompt structural stability.

---

## 8. How This Connects to the Main Chapters

This bridge doc works best read alongside:

- Read `h04` first: Know that prompts aren't big strings but section collections
- Then read this page: Understand why section order and stability directly affect caching
- Then read `h08`: You'll understand that skill injection as user messages isn't an arbitrary choice but a design decision tightly bound to caching strategy

---

## 9. The One Takeaway from This Page

In agent systems that support prompt caching, prompt structure isn't just about "how to express rules" — it's about "how to avoid paying the same context cost every turn."

This is why Hermes doesn't simply stuff all information into the system prompt but consciously protects its stable prefix.
