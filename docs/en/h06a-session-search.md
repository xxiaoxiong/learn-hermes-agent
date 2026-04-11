# h06a — Session Search: Why Retrieving Historical Sessions Is More Than "Database Queries"

> This page extends `h06`. The main chapter covered how SQLite + FTS5 saves and searches sessions; this bridge doc emphasizes another layer of understanding: **when `session_search` is actively invoked by the agent, it's no longer just a data-layer query but becomes the agent's internal recall mechanism.**

---

## The Bottom Line

From a database perspective, `session_search` is simply: give a query, return matching history records.

But from the agent's perspective, it's actually:

- Recalling whether similar problems appeared in the past
- Retrieving a specific historical context
- Bringing historical clues back into the current reasoning chain

So the significance of `session_search` goes far beyond "the database has a search method." It is the bridge that truly connects session storage to the agent loop.

---

## 1. Why SQLite Alone Isn't Enough

Saving sessions only solves the first step: history isn't lost. But saving doesn't equal usable.

If the agent cannot proactively retrieve history when needed, those sessions are more like cold archives than a working memory system.

So `h06` to truly land requires not just `save_session()` and `search()`, but:

- The agent can actively trigger `session_search` during conversations
- Search results can re-enter the current context
- The model can continue reasoning based on historical clues

---

## 2. Why `session_search` Differs from Normal Search Tools

On the surface, it looks similar to searching files or web pages: input keywords, return results.

But the key difference is:

- It doesn't search external materials
- It searches the agent's own past conversation history
- Results often have temporal continuity with the current task

In other words, `session_search` is more like:

**An internal retrieval of the agent's own working memory.**

This is why it's closer to an agent-level tool than a regular information search.

---

## 3. From "Archive" to "Recall" — The Gap Is One Injection

The most critical point about `session_search`: database hits don't automatically change model behavior.

What actually makes it a "recall mechanism" is:

- Retrieved results are injected into the current messages
- The model sees these historical summaries or fragments in the next turn
- Current reasoning is supplemented by past experience

In other words, recall doesn't happen in the database — it happens **after retrieval results re-enter the context.**

---

## 4. Why FTS5 Is Not Just an Implementation Detail for the Agent

For database engineers, FTS5 is a full-text indexing technology. But for the agent, it brings a capability boundary:

- Can it quickly locate relevant sessions among vast history?
- Can it re-find old clues after context has been compressed?
- Can "having done a similar task before" truly influence the current turn?

Without full-text indexing, sessions are saved but retrieval would be too slow or fragile — unlikely to become a capability the agent routinely uses.

So FTS5's significance here isn't about showing off technology but making "history is searchable" cheap and practical enough.

---

## 5. Why `session_search` and `lineage` Are a Design Pair

Once you introduce compression, a problem arises: the current session only has summaries and the most recent turns; early details are no longer in the working window.

At this point, `session_search`'s value amplifies immediately because it can:

- Re-search historical sessions along the record
- Retrieve more complete expressions from before compression
- Bring old version details back into the current context

Without lineage, you might only find "the current compressed version"; with lineage, you can more easily retain and search original lineage nodes.

So: `h05` solves "how to compress," `h06` solves "how to store," and `h06a` solves "how to make stored history usable again."

---

## 6. When the Agent Should Proactively Use `session_search`

### Scenario 1: The user says "Do it like last time"

This expression inherently requires the agent to find similar past history, not just guess from the current window.

### Scenario 2: The current task relates to a much earlier session

For example: provider fallback was discussed before, a skill usage was confirmed, or a similar document structure was written. Proactively searching history is more stable than reasoning from scratch.

### Scenario 3: Context has been compressed; the current window no longer contains the full backstory

Here `session_search` is providing a "way back" that compensates for compression.

---

## 7. Why It's Not the Same as Long-term Memory

`session_search` and `memory` are easily confused, but they serve different roles:

- `memory`: Refined, relatively stable, long-term knowledge suitable for prompt injection
- `session_search`: Preserves raw history, searched on demand, temporarily pulling past records into the current turn

Think of them as:

- Memory is like "long-term organized notes"
- Session search is like "going back to the filing cabinet to dig up old case files"

Both are important, but they're not the same thing.

---

## 8. How This Connects to the Main Chapters

- Read `h03`: First learn that agent-level tools are more than regular tools
- Read `h06`: Learn how history is persisted and indexed with SQLite + FTS5
- Read this page: Truly piece together how `session_search` brings history records back into the agent loop

This way `session storage` won't be misunderstood as "just adding a database."

---

## 9. The One Takeaway from This Page

`session_search` isn't about adding a query interface to a database — it's about letting the agent proactively go back into its own history to find clues when needed, then bring those clues back into current reasoning.

This is why session storage in Hermes ultimately leads to an agent-level tool, rather than stopping at the storage layer.
