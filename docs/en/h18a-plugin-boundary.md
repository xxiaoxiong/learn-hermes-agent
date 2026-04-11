# h18a — Plugin Boundary: Why Plugins Are the Capability Assembly Layer, Not the Behavioral Prompt Layer

> This page extends `h18`. The main chapter showed that plugins can register tools, hooks, commands, and memory providers; this bridge doc explains the deeper boundary: **plugins truly extend the agent's capability assembly surface, not behavioral prompts for the model like skills do.**

---

## The Bottom Line

When first seeing plugins and skills listed together, many feel both are "extending the agent."

So a vague but dangerous understanding easily forms:

- Skills are lightweight plugins
- Plugins are advanced skills
- They only differ in implementation

This understanding is wrong. Both extend the system in Hermes, but they extend **completely different layers**:

- **Plugins** extend the capability assembly layer
- **Skills** influence the model's operating guide layer

Without drawing this line clearly first, reading hooks, memory providers, and slash command extensions will all get confused.

---

## 1. Why Plugins Are Not "Something Written for the Model to See"

Skills' core product is text: frontmatter, trigger conditions, markdown body, ultimately injected into conversations. They directly influence what the model does "this turn."

Plugins take a completely different path. Their core actions are: registering tools, hooks, commands, memory providers, and interacting with the runtime.

Most of these actions happen before the model starts thinking. Plugins aren't supplementing prompt words for the model — they're **changing the working environment the model operates in.**

So plugins are first runtime assembly, not prompt engineering.

---

## 2. Why Plugins Extend the "Capability Assembly Layer"

The capability assembly layer means:

> Before the agent actually runs, what capabilities does the system assemble onto it?

For example: which tools are registered in the registry, which hooks fire during the lifecycle, which CLI commands are available, where memory reads from and writes to.

None of these are reasoned by the model — they're decided by the runtime during assembly. Plugins work at exactly this position.

So they're not session-level behavioral suggestions but startup/runtime capability injection interfaces.

---

## 3. Why PluginContext Is Critical

Hermes doesn't let plugins directly grab and modify core internal objects — it gives them a `PluginContext` facade.

This matters because it says: Hermes allows extension but doesn't surrender internal boundary control.

Plugins can change system capability assembly, but they must do so through a controlled interface. This difference from skills is also clear:

- Skills' boundary is mainly "what content to inject"
- Plugins' boundary is mainly "which runtime surfaces are modifiable"

So `PluginContext` isn't just a convenience API — it actually is the plugin system boundary itself.

---

## 4. Why "Plugins Can Register Hooks" Doesn't Mean Hooks Equal Plugins

Sometimes readers mix one more layer: plugins can register hooks, so aren't hooks plugins?

Also no. More accurately:

- Hooks are lifecycle insertion points
- Plugins are complete functional modules
- Plugins can utilize hooks as one extension mechanism

So hooks and plugins have a "tool and vehicle" relationship, not synonyms.

This is why `h14` and `h18` should be read together: `h14` explains what hooks can and can't do; `h18` explains who can systematically leverage these hooks to extend capabilities.

---

## 5. Why Memory Provider Plugins Best Expose This Boundary

Memory providers are an excellent example. What they do is not: tell the model how to remember, or give the model an explanation about memory.

They do something more fundamental: swap out the memory storage backend, making the runtime read and write memory from a new provider.

They modify the system's structural capabilities, not the model's behavioral prompts. This directly demonstrates:

> Plugins extend runtime substrate; skills extend reasoning guidance.

Both look like "influencing behavior" but at completely different levels.

---

## 6. Why Plugins Also Cannot Cross Control Plane Boundaries

Although powerful, plugins don't mean they can bypass system boundaries at will.

A healthy plugin extension should still satisfy: new tools enter the unified registry, new hooks enter the unified lifecycle, new commands enter the unified command surface, memory providers still obey unified runtime call boundaries.

If a plugin sneaks around to accomplish these things, it's not extension — it's creating invisible forks.

So the plugin system's design goal isn't "giving you unlimited internal modification" but:

> Without forking Hermes, giving you a controlled set of capability assembly entry points.

---

## 7. Why Plugins and Skills Must Both Exist, Not Either-Or

With only skills: you can change the model's operating style but can't truly add new capabilities.

With only plugins: you can add tools and extension points but can't fine-grain tell the model "how to approach this task."

So Hermes keeping both shows it distinguishes two completely different extension needs:

- **Capability extension**: plugins
- **Behavioral guidance**: skills

This isn't redundant design — it's tiered division of labor.

---

## 8. A Useful Decision Rule

When you want to extend Hermes, ask yourself:

### Am I changing what the agent can do?

Examples: one more tool, one more hook, one more slash command, a different memory backend.

→ Use a plugin.

### Am I changing how the agent does this type of task?

Examples: do X first then Y, prefer a certain output format, which process to follow in certain scenarios.

→ Use a skill.

This decision rule is simple but blocks most boundary confusion.

---

## 9. How This Connects to the Main Chapters

- `h08`: Understand skills are operating guides, not system prompt extensions
- `h14`: Understand hooks are lifecycle insertion points, not control flow takeover points
- `h18`: See how plugins systematically use tools / hooks / commands / memory providers to extend Hermes
- This page: Thoroughly calibrate the layer boundary between plugins and skills

---

## 10. The One Takeaway from This Page

Plugins extend the agent's capability assembly surface: they change what working environment the runtime prepares for the model. Skills extend the model's behavioral prompt surface: they change how the model should approach the current task.

Both extend Hermes, but they're absolutely not the same kind of extension.
