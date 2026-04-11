# h16a — Runtime Route: Why Provider Runtime's True Unification Isn't "Vendor Name" but Turn-level Route Results

> This page extends `h16`. The main chapter covered the `(provider, model) → api_mode` mapping; this bridge doc explains a deeper runtime perspective: **Hermes' truly stable abstraction isn't "which provider I'm using" but "what runtime route this turn's call gets resolved to."**

---

## The Bottom Line

Many people first understand provider runtime by focusing on: Is this OpenAI or Anthropic? OpenRouter or Ollama? Official endpoint or compatible endpoint?

These matter, but inside Hermes, the more critical questions are:

- Which API mode does this turn actually use?
- Which key / base_url combination is selected?
- After failure, which route does the next turn switch to?

The system truly depends not on the provider name itself but on the **route result** parsed for each call at runtime.

---

## 1. Why "Writing if-else by Vendor" Quickly Becomes Messy

The simplest intuition: OpenAI gets one path, Anthropic another, OpenRouter yet another, local models yet another.

But as the system grows complex, you'll quickly hit these problems:

- The same provider may support more than one calling mode
- The same model may need different paths due to different `base_url`
- After fallback, the provider changes and the entire branch logic must re-run
- Credential pools, different accounts, different endpoints also need to participate in decisions

If the abstraction still stops at "vendor name," the runtime becomes an ever-expanding branch forest.

---

## 2. Hermes Truly Unifies Turn-level Runtime Routes

A more reasonable understanding compresses each call into a standard runtime result:

- `provider`
- `api_mode`
- `base_url`
- `api_key`
- `source`

This result is what the agent actually consumes. AIAgent doesn't need to know whether it was inferred from env, explicitly specified in config, polled from a credential pool, or temporarily switched after fallback.

It just needs a fully resolved route, then executes accordingly. So provider runtime's core job isn't "identifying vendors" but "resolving this turn's call into a clear path before the turn begins."

---

## 3. Why `api_mode` Is Closer to the True Branch Point than Provider Name

From the agent loop's perspective, what actually drives code path branching isn't usually the vendor but:

- `chat_completions`
- `anthropic_messages`
- `codex_responses`

The final branching happens along these API modes.

- Provider is a source label
- `api_mode` is the execution dialect

If you only watch the provider, you might mistakenly think "switching vendors = switching the entire runtime architecture." But Hermes flattens the problem:

> Regardless of upstream, as long as it resolves to a unified route, the agent loop stays unchanged.

---

## 4. Why the Route Must Be "Re-resolved Every Turn"

A common misconception: the provider is determined once at startup and that's enough.

But Hermes isn't a static single-path system. It encounters: fallback provider switches, token/key rotation, different auxiliary tasks using different routes, certain base_urls inferring modes different from the main model.

This means the runtime route isn't "process startup config" but more like:

> An immediate resolution of the execution path made just before this turn's call.

So route granularity is naturally turn-level, not app-level. Once you understand this, many phenomena make sense: why the agent doesn't need to rewrite the main loop after fallback, why auxiliary calls may use different providers, why credential pools aren't just config but runtime allocators.

---

## 5. Why Credential Pool Should Also Be Seen as Part of the Route

Many see credential pools as a peripheral "account rotation feature." But from the runtime route perspective, it's not a peripheral feature — it's part of route resolution.

For the same provider: which key is selected, what runtime_base_url it corresponds to, and which source it comes from — all directly affect this turn's actual execution path.

Hermes doesn't first fix the provider then randomly pick a key; it resolves provider, mode, base_url, and credential together into a single route.

So credential pool is more like a route assembler, not a simple "account list."

---

## 6. Why Fallback Is Essentially Re-computing the Route, Not "Trying a Different Model"

From the runtime perspective, what fallback actually does is: re-select provider/model, re-resolve api_mode, re-resolve credentials, and ultimately produce a new runtime route.

So fallback doesn't force another attempt on the original path — it:

> Switches to a new route and continues pushing the same task forward.

This clearly distinguishes:

- Retry: same path retry
- Fallback: switch to a new path

This is the most valuable connection between `h10` and `h16`.

---

## 7. Why "Unified Route" Is Also the Foundation for Multi-platform Capabilities

Provider runtime looks like a model interface layer issue, but it connects to higher-level platform capabilities.

Because regardless of whether the request comes from CLI, Gateway, cron, subagent, or plugin-injected calls — once it reaches AIAgent execution, the route still needs resolving.

Route abstraction isn't some provider submodule's local trick — it's the universal interface for the entire platform runtime. Platform entry points can differ, but before actually sending a request to the model, everyone must first be flattened into the same route language.

---

## 8. When to Return to This Page

### When provider configs feel increasingly numerous

You might still be thinking in "vendor lists" rather than "unified route results."

### When starting fallback / auxiliary routes

This is when it's easiest to see: different call paths share a common abstraction — the route, not the provider name.

### When you want to add a new provider without touching the main loop

This is this page's core conclusion: as long as a new provider can be resolved into a unified route, there's no need to modify the agent loop.

---

## 9. How This Connects to the Main Chapters

- `h10`: Understand retry, fallback, continuation as different-tier recovery actions
- `h16`: See how provider runtime flattens model calls into three API modes
- This page: See that Hermes' truly unified abstraction is turn-level routes, not provider names
- `h17` / `h18`: Then understand why the runtime needs a consistent consumption surface for plugins and external capabilities

---

## 10. The One Takeaway from This Page

What's truly stable in Hermes isn't "which provider I'm using" but the runtime route resolved before each turn's call.

Providers can change, credentials can rotate, fallbacks can reroute; but as long as the route result remains unified, the agent loop doesn't need to change with it.
