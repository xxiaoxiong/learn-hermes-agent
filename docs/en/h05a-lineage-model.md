# h05a — Lineage Model: Why Compressed Sessions Must Not Overwrite the Original History

> This page extends `h05`. The main chapter told you that context compression generates a new `lineage_id`; this bridge doc explains the design behind it: **why compression creates a new lineage node rather than overwriting the old session.**

---

## The Bottom Line

If compression directly overwrites the old session, the system immediately loses three important capabilities:

- Cannot trace back to the full pre-compression history
- Cannot explain "which segment of history this summary was distilled from"
- Cannot let the search system freely jump between original and compressed versions

So Hermes' approach is not:

> Make the old history shorter

But rather:

> Generate a new, shorter session that points back to the previous parent session

This is the core of the lineage model.

---

## 1. Why "Overwriting the Old Session" Is Tempting

On the surface, direct overwriting is the simplest:

- Only one session ID in the database
- Current context gets shorter
- Storage appears more efficient

But the problem is that it conflates "current working window" and "historical fact archive" into one thing.

Compression is meant to solve: the current window is too large for continued reasoning.

It shouldn't also rewrite: what actually happened in the past.

---

## 2. The Two Sessions Before and After Compression Are Not the Same Semantic Object

The pre-compression session represents:

- Original message trajectory
- Complete tool call / tool result history
- The actual context sequence that occurred

The post-compression session represents:

- A working window reorganized for continued execution
- Middle portions already folded into summaries
- Better suited for next-turn reasoning, but no longer equal to the original history

Both objects genuinely exist, but they serve different responsibilities. So the most reasonable approach is coexistence, not overwriting.

---

## 3. The Essence of Lineage: Making "Runnable Window" and "Historical Archive" Simultaneously Valid

You can think of lineage as a genealogy chain:

```text
session-001  Original full history
   ↓ compress
session-002  Post-compression working window
   ↓ compress again
session-003  Second-compression working window
```

What matters most here isn't the numbering but the parent-child relationships:

- `session-002.parent_session_id = session-001`
- `session-003.parent_session_id = session-002`

This lets the system simultaneously maintain:

- A current window that's short enough, clean enough, and ready to continue
- Original history that's still traceable, searchable, and explainable

---

## 4. Why the Summary Block Itself Cannot Replace Original History

Many people think:

> Since we already have a summary, is the original history still important?

This is the most common pitfall. Summary and original history have completely different semantic status:

- Summary is the post-compression explanation layer
- Original history is the factual layer of what actually happened

Summaries can help the model quickly understand prior context and reduce context length. But summaries cannot guarantee all details are preserved, serve as audit-level original records, or provide the foundation for more fine-grained searches later.

So summaries are a runtime convenience, not a stand-in for historical truth.

---

## 5. Why Lineage and FTS / Session Search Naturally Work Together

Once you design sessions with lineage, many downstream capabilities fall into place:

- FTS5 can index the original session
- The current working window can reference the compressed session
- `session_search` can find old versions and bring results back to the current context

Without lineage, with only "the overwritten current version," many things become ambiguous:

- Is the search result the original phrasing or the summary-rewritten version?
- Does the current session's content still correspond to the original real tool trajectory?
- Was a key piece of information originally present, or was it abstracted during compression?

Lineage preserves the answers to these questions.

---

## 6. Why This Is Not Just a Database Implementation Detail

Many people see `parent_session_id` as a storage-layer trick. It's not.

It feeds back into how you understand the entire agent system:

- Sessions are not single static boxes but an evolving lineage
- Compression is not destructive rewrite but derivation of a new node
- Search, recovery, and audit see not just "current state" but "how the state evolved"

In other words, the lineage model upgrades sessions from "snapshots" to "trackable history chains."

---

## 7. When You'll Most Feel the Value of Lineage Design

### Scenario 1: The user says "You didn't say that before"

Without lineage, you can only see the compressed summary version; with lineage, you can follow the parent chain back to the original context.

### Scenario 2: You need to search for a keyword from much earlier

If the original session still exists, FTS can find it; if only the summary remains, many fine-grained terms may have been lost.

### Scenario 3: You need to debug whether the compression strategy dropped important information

With lineage, you can compare pre- and post-compression sessions side by side; without lineage, you have no original version to compare against.

---

## 8. How This Connects to the Main Chapters

This bridge doc works best read across three chapters:

- `h05`: First understand the goal and basic mechanism of compression
- This page: Then understand why compression generates a new lineage node rather than overwriting
- `h06`: Finally see how these lineage nodes are stored in SQLite, truly preserved via `parent_session_id`

Together, these three chapters make the compression model complete.

---

## 9. The One Takeaway from This Page

Compression solves "the current window is too long," not "history is no longer important."

So Hermes' lineage model is not an optional add-on layer but the core structure ensuring that compression, search, recovery, and audit can all coexist.
