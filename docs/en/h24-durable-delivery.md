# h24 — Durable Delivery and Observability

An agent generating a final answer does not mean the user received it. v0.19 closes the crash window between generation and platform acknowledgement with a durable delivery-obligation ledger.

The result is recorded in `state.db` before the platform send. The adapter sends it with an idempotency key, waits for acknowledgement, and only then marks the obligation complete. Unacknowledged obligations are recovered and replayed after restart without silently losing a paid-for turn.

Delegated children also expose readable live transcripts containing tool calls, results, and streamed replies. Background completion records retain ownership so results can be recovered and delivered after a process restart.

A production-grade task is complete only when output is generated, durably recorded, observable, and either acknowledged by the target platform or covered by a recoverable retry obligation.

**Official source areas:** gateway delivery-obligation ledger, `state.db`, and background delegation records.
