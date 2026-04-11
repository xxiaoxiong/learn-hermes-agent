# h17a — MCP Capability Layers: Why MCP Is More Than "External Tool Integration"

> This page extends `h17`. The main chapter showed how MCP tools enter the same registry; this bridge doc adds the fuller platform perspective: **MCP isn't just an external tool directory — it's actually a set of capability layers, and tools are merely the first facet to enter the main line.**

---

## The Bottom Line

Many people first understand MCP as: start an external server, pull some tools, register them into the registry, call them like native tools.

This understanding isn't wrong, but it only captures the easiest layer to get started with.

As you go deeper into real systems, you'll quickly encounter: how servers connect, why some are connected while others are pending, why some need authentication, and why there are resources, prompts, and elicitation beyond tools.

If your mental model still only includes "external tool integration," MCP becomes increasingly scattered to learn.

---

## 1. Why the Main Line Should Stick to Tools-first

Teaching tools first is correct because it connects most naturally to previous chapters: native tools, external tools, same dispatch path.

This main line quickly establishes:

> After MCP tools enter the same registry, they're fundamentally no different from native tools to the agent.

But stopping here also leaves a hidden pitfall: readers may think MCP is only a tool transport.

So this bridge doc's task isn't to overturn the main line but to supplement: tools-first is the entry point; capability layers are the more complete platform perspective.

---

## 2. What Is a Capability Layer?

A capability layer means: don't mix all MCP details into one lump — decompose them by responsibility into several capability facets.

A practical minimal layering:

1. **Config Layer** — Where server configs come from and what they look like
2. **Transport Layer** — Connecting via stdio / HTTP / streamable transport
3. **Connection State Layer** — Current status: connected / pending / failed / needs-auth
4. **Capability Layer** — tools / resources / prompts / elicitation
5. **Auth Layer** — Whether OAuth / token / other authorization flows are needed
6. **Router Integration Layer** — How it connects back to registry, permission, notification

Once you have this map, you'll stop seeing MCP as just a "black box that returns tool lists."

---

## 3. Why Tools Are Just One Part of the Capability Layer

The main line in Hermes cares most about tools for simple reasons: tool schemas directly enter the model's visible capability surface, dispatch paths are easiest to reuse, users most easily feel that "external capabilities have been integrated."

But from a platform perspective, MCP doesn't necessarily expose only tools. Some capabilities aren't detailed in the current teaching main line, but you need to know their positions:

- **Resources**: External context resources
- **Prompts**: Server-side reusable prompt fragments
- **Elicitation**: Server reverse-requesting additional input

This means MCP isn't as narrow as "tool protocol" — it's an "external capability platform protocol."

---

## 4. Why Connection State Can't Be Mixed with Capability Exposure

Another common confusion: server is configured → tools should already be available.

But in real systems, there's a connection state layer in between. A server may be: connected, pending, failed, needs-auth, or disabled.

Capability exposure must be built on the premise that connection state is sufficiently healthy.

Without thinking this through, many misunderstandings emerge: why the config exists but the tool list is empty, why some servers don't register successfully, why tools can't be exposed to the agent when authentication isn't complete.

So "can it be used" is first a connection state issue, then a capability integration issue.

---

## 5. Why Auth Layer Shouldn't Be Stuffed into the Main Line from the Start

Authentication certainly matters in real MCP usage. But if the main text immediately dives into OAuth callbacks, token refresh, third-party authorization states, and external auth handshakes — beginners immediately lose the main thread.

A better teaching order: first let readers know the auth layer exists, then know it affects connection state, and only during platform-level deep dives detail the authentication flow.

This is also a role well-suited for bridge docs: don't interrupt the main line, but set up the complete map in advance.

---

## 6. Why Router Integration Determines Whether MCP Has Truly "Entered the System"

The real key to Hermes integrating MCP isn't just "connecting to the server." It's:

- Whether list_tools schemas enter the unified registry
- Whether calls still pass through permission / approval / logging boundaries
- Whether tool results still flow back through the same tool_result pipeline

MCP truly entering the system doesn't happen at the transport layer — it happens at the integration layer.

If some external capability bypasses this unified integration, what you get isn't capability extension but a sneaky side path growing at the system's edge.

So this page's most important line is:

> Capabilities can come from external sources, but the control plane must not fork.

---

## 7. Why This Page Connects to h02 / h09 / h18

### With `h02`

External MCP tools ultimately need to return to the same registry logic; otherwise they can't share schema, dispatch, and tool_result's unified abstraction.

### With `h09`

External tools bypassing permission would open a backdoor at the system's edge.

### With `h18`

The plugin system is also an extension surface, but it extends local capability assembly; MCP extends the remote capability surface. These two are easily confused but operate at different layers.

---

## 8. A Useful Decision Rule

When looking at an MCP design, ask first:

- **Is it describing a connection problem?** → Transport / connection state / auth layer.
- **Is it describing what capabilities are exposed?** → Capability layer.
- **Is it describing how to enter Hermes' unified control plane?** → Router integration layer.

This prevents you from treating server config, connection state, tool lists, and permission integration as the same thing.

---

## 9. How This Connects to the Main Chapters

- `h17`: Understand how MCP tools enter the same registry / dispatch path
- This page: Supplement that MCP is actually a set of capability layers, not just a tool directory
- `h18`: Then see the plugin system — more easily distinguish "local extension surface" from "remote capability surface"

---

## 10. The One Takeaway from This Page

MCP isn't just "integrating external tools" — it's a set of capability layers spanning configuration, connection, authentication, capability exposure, and unified integration into the control plane.

Tools are merely the first layer to enter the main line and the easiest to teach, but definitely not the whole picture.
