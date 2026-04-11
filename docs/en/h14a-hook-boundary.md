# h14a — Hook Boundary: Why Hooks Can Extend Behavior but Cannot Take Over the Main Loop

> This page extends `h14`. The main chapter emphasized that hooks can only observe and annotate; this bridge doc explains this restriction more thoroughly: **hooks' value is built precisely on the boundary that they "cannot take over control flow."**

---

## The Bottom Line

Many people see hooks and naturally think: Can I change execution order here? Block a tool? Have a plugin replace main loop logic?

These impulses are normal, but Hermes deliberately refuses them. Because once hooks can both observe and control, the system quickly loses predictability.

So hooks' true positioning is:

**Inject additional behavior around the main loop, without taking over the main loop itself.**

---

## 1. Why "Making Hooks a Bit More Powerful" Always Sounds Tempting

From a plugin author's perspective, the ideal world seems to be: modify parameters in pre-hooks, replace results in post-hooks, change control flow in error hooks. Plugins appear omnipotent.

But the cost appears immediately:

- The main loop is no longer the sole control center
- Different hooks interact with and potentially fight each other
- Whether a plugin is registered can change core system semantics

"Extensible" would quickly slide toward "unpredictable."

---

## 2. Hook, Approval, and Agent-level Tool Boundaries Must Be Distinct

Hermes already has several mechanisms that truly participate in control flow:

- Agent-level tool interception
- The approval pipeline
- The main loop's own dispatch / continuation logic

These modules exist precisely so the control plane has clear ownership. If hooks also start taking over these things, boundary overlap occurs:

- Some plugins secretly deny in pre-tool hooks
- Some plugins rewrite tool results in post-hooks
- Some plugins try to bypass approval rules

Ultimately, who truly controls the agent becomes unclear. Hermes preserves hooks' "weak power" precisely to protect the system's overall explainability.

---

## 3. Why "Can Only Observe and Annotate" Doesn't Mean Hooks Are Weak

Many people hear "no control flow" and assume hooks are useless. Not true.

In the right position, they're still very powerful: logging, timing, telemetry reporting, injecting observation data, triggering notifications, side-channel recording when errors occur.

These are all important, and they share one trait:

**They enhance the system's visibility and integrability without rewriting core execution semantics.**

This is exactly what a healthy hook system should do.

---

## 4. Why Hook Exceptions Must Not Affect the Main Loop

`h14` has a critical but easily underestimated design: hooks crashing shouldn't bring down the agent's main flow.

This isn't just error tolerance — it expresses hooks' status:

- Hooks are the supplementary layer
- The main loop is the foundation layer

Supplementary layer failures must not topple the foundation layer. Otherwise you'd get a fragile system: a statistics plugin crashes, and the entire agent stops working. That clearly violates hooks' design intent.

---

## 5. A Useful Decision Rule: Is This Extension Logic "Describing Process" or "Changing Decisions"?

### If it describes process

Examples: recording how long a tool call took, sending a notification after a response, sending telemetry to an observability system.

→ Well-suited for hooks.

### If it changes decisions

Examples: preventing a tool from executing, rewriting tool parameters, deciding whether to continue the next loop iteration.

→ Shouldn't be handled by hooks. Should go into approval, dispatch, agent-level tools, or the main loop itself.

This question almost cleanly cuts the boundary.

---

## 6. Why Plugin Extensibility Actually Depends on Hook Restraint

This is somewhat counterintuitive but very important:

> The plugin system can safely extend precisely because hooks weren't given excessive control power.

If plugins could arbitrarily change control flow:

- Combining two plugins might produce unpredictable behavior
- Users can't know which logic set the system currently follows
- Upgrading, debugging, and reproducing issues all become extremely difficult

When hooks stay within the observe/annotate boundary, plugins become easier to: stack, debug independently, and controllably unload.

So "restraint" isn't limiting plugins — it's preserving order for the plugin ecosystem.

---

## 7. Why This Page Is Tightly Bound to `h18 Plugin System`

If you don't see hook boundaries clearly first, you'll easily expect too much when reading the plugin system:

- Thinking plugins can take over Hermes like a fork
- Thinking register_hook equals main loop control power
- Thinking any runtime policy can be changed via plugins

But Hermes plugins' more accurate positioning is: register tools, register hooks, register commands, extend peripheral capabilities — not rewrite agent core dispatch.

So this page is actually laying the groundwork for `h18`.

---

## 8. How This Connects to the Main Chapters

- `h09`: Understand which things must be decided uniformly at the dispatch layer
- `h14`: Understand hook lifecycle and registration
- This page: See that hooks are safely extensible precisely because they don't take over control flow
- `h18`: Read the plugin system with a better understanding of extensibility's true boundaries

---

## 9. The One Takeaway from This Page

Hooks' value isn't in secretly rewriting the main loop — it's in adding observation, integration, and supplementary behavior to the system without rewriting the main loop.

Precisely because Hermes holds this boundary, plugins don't turn the agent into an unpredictable tangle of branching logic.
