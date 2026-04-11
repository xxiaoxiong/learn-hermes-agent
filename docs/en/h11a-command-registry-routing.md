# h11a — Command Registry Routing: Why the Key to Slash Commands Isn't the "Command Name" but Unified Route Descriptions

> This page extends `h11`. The main chapter introduced `COMMAND_REGISTRY`; this bridge doc explains a deeper layer: **what slash commands truly unify isn't string matching but "how the same command description gets routed, parsed, and executed across multiple endpoints."**

---

## The Bottom Line

`/search`, `/skills`, `/memory` — these commands look like simple strings.

But in Hermes, what truly matters isn't the name itself but the unified command description behind it:

- What it's called
- What aliases it has
- Which platforms support it
- Who handles it
- How parameters are interpreted

So `COMMAND_REGISTRY`'s value isn't "having a dictionary that stores commands" but **decoupling command semantics from platform entry points.**

---

## 1. Why "Command Dispatch" Is a Bigger Problem Than It Looks

If you only build for CLI, a simple `if input.startswith("/search")` might suffice.

But Hermes faces: CLI, Gateway, Telegram, and other messaging platforms. Their input sources differ, output formats differ, and interaction constraints differ. If each platform writes its own command parsing logic, the system quickly becomes: same command names, different implementation details, inconsistent support ranges, drifting documentation and behavior.

So the real problem isn't "how to recognize `/search`" but:

> How to let one command maintain a single definition across multiple entry points.

---

## 2. The Registry Truly Unifies "Command Objects," Not "Command Strings"

This is critical. Strings are just entry points; what truly needs reuse is the command object itself, including: primary name, aliases, platform restrictions, handler, help text, parameter schema.

Platforms see not "how to handle this string" but:

> Which `CommandDef` does this string ultimately resolve to?

This upgrades the command system from "scattered string judgments" to "a unified command-model-driven routing system."

---

## 3. Why Alias Resolution Shouldn't Be Each Platform's Responsibility

Aliases look like a small input-layer problem: `/s` for `/search`, `/skill` for `/skills`.

But once each platform handles this independently, subtle fragmentation occurs: CLI supports `/s`, Telegram doesn't, Gateway supports a different set of abbreviations. You're no longer maintaining one command system but multiple look-alike command dialects.

So aliases must belong to the shared resolution layer, not the platform entry layer. Platforms only hand over text; they don't redefine command semantics.

---

## 4. Why Platform Support Should Also Be Written in the Command Description

Some commands may only suit CLI; others suit all endpoints. If platform support scope is scattered across each endpoint's implementation: documentation doesn't know where support exists, new platforms don't know which commands are available by default, and the same command's availability across endpoints becomes increasingly hard to track.

Putting `platforms` in `CommandDef` expresses something important:

> Platform support is part of the command definition, not an incidental decision in entry-point code.

---

## 5. Why This Page Also Directly Relates to Gateway

`h11` appears to be about CLI architecture, but it's naturally connected to `h12` Gateway. Because gateway doesn't reinvent a command system — it reuses the same registry:

- Platform entry points convert messages to text
- Text goes into the shared `resolve_command()`
- Returns a unified `CommandDef`
- The current platform context then determines how to format the response

So the command system and gateway aren't "two independent modules" but:

- `h11` provides unified command semantics
- `h12` provides multi-platform message entry points

Together, slash commands truly work cross-platform.

---

## 6. A Useful Decision Rule: Is This Logic Explaining "What the Command Is" or "How the Platform Receives Messages"?

### If it explains what the command is

Examples: what aliases `/search` has, what parameters `/skills` needs, which platforms support this command.

→ Belongs in the registry / resolve layer.

### If it explains how the platform receives messages

Examples: how Telegram message text is extracted, how CLI input is read, how Discord interaction events are converted back to command strings.

→ Belongs in the entry adapter layer.

---

## 7. Why the Skin Engine Also Fits This Picture

`skin_engine.py` looks like a CLI visual layer unrelated to command routing. But it completes an important fact:

- Registry determines "what the command is"
- Platform adapter determines "where the message comes from"
- Skin / rendering determines "how the result is displayed"

This shows Hermes doesn't blend "parsing, execution, rendering" into one lump but maintains layering: routing layer, execution layer, presentation layer.

This is also why the command architecture can serve both CLI and Gateway without being locked to terminal interaction.

---

## 8. How This Connects to the Main Chapters

- `h11`: Understand `CommandDef` and `COMMAND_REGISTRY`
- `h12`: Understand how platform adapters unify different sources into one message entry point
- This page: See that the registry truly unifies command semantics and route descriptions, not a bunch of string if-else statements

---

## 9. The One Takeaway from This Page

The core of slash commands isn't "matching which command name" but having all platforms point to the same command description object, then letting a unified routing layer decide how to execute it.

This is the real value of `COMMAND_REGISTRY` in Hermes.
