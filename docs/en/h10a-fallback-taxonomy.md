# h10a — Fallback Taxonomy: Why Retry, Fallback, and Continuation Are Not the Same Recovery Action

> This page extends `h10`. The main chapter covered error classification and `fallback_providers`; this bridge doc goes one step further: **when a call fails, what the system truly needs to distinguish isn't "should we retry" but "which layer did the failure occur at, and which layer should recovery happen at."**

---

## The Bottom Line

Many systems compress error recovery into one sentence:

> If it fails, retry; if that doesn't work, switch models.

This is too coarse. Hermes' more accurate approach splits recovery actions into at least three tiers:

- **Retry**: Same path, try again
- **Fallback**: Switch to a different path and continue
- **Continuation**: Bring the failure result back into the loop and let the agent re-decide

These three are not synonyms — they are three different levels of recovery action.

---

## 1. Retry Solves "This Path Might Just Be Temporarily Down"

Retry's assumption: this failure is transient, the original provider/model might still succeed, no need to change strategy yet.

Typical scenarios: 429 rate limiting that may recover in seconds, 5xx upstream jitter, 408/504 timeout that might clear up.

Retry's essence: **Don't change the route yet; just give the original route one more chance to recover.**

---

## 2. Fallback Solves "Continuing on This Path Is No Longer Worth It"

Fallback's assumption differs from retry: the current provider may be persistently unavailable, the current model's capacity or quota doesn't suit this task, switching paths is more reasonable than waiting.

Typical scenarios: persistent rate limiting on the primary provider, invalid API key (401), an auxiliary model lacking required capabilities.

Fallback's essence: **Acknowledge the original route isn't worth continuing; maintain the task objective but switch the implementation path.**

---

## 3. Continuation Solves "The System Shouldn't Exit the Main Loop Just Because of One Failure"

Retry and fallback both stay at the "model call layer." But Hermes has a third level:

- Even if this call ultimately fails
- The entire task shouldn't be immediately declared dead
- The error itself can serve as a result, flowing back to the agent

This is continuation's role. It's not retrying, nor switching providers — it's:

- Packaging the failure as part of the current turn
- Letting the agent re-judge what to do in the next round

So continuation belongs to **control flow recovery**, not low-level API recovery.

---

## 4. Why Mixing These Three Causes Problems

If you treat retry, fallback, and continuation all as "failure handling," two bad outcomes typically emerge:

### Bad Outcome 1: Retrying stubbornly when you should switch paths

E.g., a 401 or persistently unavailable provider — should fallback, but keeps retrying in place.

### Bad Outcome 2: Exiting the entire task after low-level recovery fails

The model could still take a different plan based on error information, but the system already stopped the main loop.

Both problems stem from not first distinguishing the failure's tier.

---

## 5. A Useful Decision Framework: First Ask "Which Layer Did the Failure Occur At?"

### Layer 1: Transport / Transient availability failure

E.g., timeout, brief rate limiting, brief 5xx. → Better suited for retry first.

### Layer 2: Current provider path failure

E.g., auth invalidation, persistent rate limiting, capability mismatch. → Better suited for fallback.

### Layer 3: Single call failed, but the task itself hasn't necessarily failed

E.g., an auxiliary step failed, a certain approach isn't viable, tool results are abnormal. → Better suited for continuation, letting the agent re-decide.

Once you locate which layer the failure belongs to, subsequent recovery actions are much less likely to go wrong.

---

## 6. Why Auxiliary Tasks Best Demonstrate This Taxonomy

In Hermes, it's not just the main conversation that can fail — auxiliary tasks can too: compression, vision, session search.

These tasks perfectly illustrate layered recovery:

- Compression small model times out → retry
- Compression provider unavailable → fallback to a cheaper backup model
- Compression ultimately still fails → continuation, let the main loop use a conservative strategy

This demonstrates: **Error recovery isn't an if-else; it's a runtime strategy decomposed by tier.**

---

## 7. Why Continuation Is Most Overlooked Yet Most Agent-like

Traditional request-based programs commonly: return error, terminate execution.

But agent systems are different. For agents, failure is also part of environmental feedback. As long as the task objective hasn't completely expired, the system should allow the model to re-judge next steps based on the failure.

This is continuation's greatest value:

- It doesn't pretend the failure didn't happen
- It doesn't escalate the failure directly to task termination
- It brings the failure back into the loop

This fits the essence of agents very well: observe environment → adjust strategy → continue pushing forward.

---

## 8. How This Connects to the Main Chapters

- `h10`: Master error code classification and fallback provider chains
- This page: See retry / fallback / continuation as three different tiers of recovery action
- `h16`: Then look at provider runtime — you'll more easily understand why the provider abstraction layer is so critical for error recovery

Without provider runtime, fallback can only be written as messy branches; with provider runtime, fallback becomes a systematic capability.

---

## 9. The One Takeaway from This Page

Failure recovery is not one action but three tiers of action:

- Try again on the same path (retry)
- Switch to a different path (fallback)
- Bring the failure back into the loop for re-decision (continuation)

Hermes' stability comes precisely from not mixing these three into one vague "error handling."
