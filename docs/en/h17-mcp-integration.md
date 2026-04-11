# h17 — MCP Integration: External Tools Sharing the Same Registry as Native Tools

> **Core Insight**: MCP tools are not "add-ons" — they enter the same registry, follow the same dispatch path, and the agent cannot tell the difference.

---

## What Is MCP?

**Model Context Protocol (MCP)** is an open protocol proposed by Anthropic that lets AI agents dynamically discover and call external tool services.

An MCP server is an independent process that communicates with the agent via JSON-RPC over stdio:

```
agent (client)          MCP server (external process)
     │                       │
     │─── initialize ────────→│
     │←── capabilities ───────│
     │─── tools/list ─────────→│
     │←── [tool1, tool2, ...] ─│
     │─── tools/call ──────────→│
     │←── tool result ──────────│
```

---

## Dynamic Tool Discovery: Handshake → Registration

```python
import subprocess
import json

class MCPClient:
    def __init__(self, server_cmd: list[str]):
        """Launch the MCP server process (stdin/stdout communication)"""
        self.proc = subprocess.Popen(
            server_cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            text=True,
        )
        self._id = 0

    def _rpc(self, method: str, params: dict | None = None) -> dict:
        """Send a JSON-RPC request and wait for the response"""
        self._id += 1
        req = {"jsonrpc": "2.0", "id": self._id, "method": method, "params": params or {}}
        self.proc.stdin.write(json.dumps(req) + "\n")
        self.proc.stdin.flush()
        line = self.proc.stdout.readline()
        return json.loads(line)["result"]

    def list_tools(self) -> list[dict]:
        """Get the list of tools provided by the MCP server"""
        result = self._rpc("tools/list")
        return result.get("tools", [])

    def call_tool(self, name: str, arguments: dict) -> str:
        """Call a tool on the MCP server"""
        result = self._rpc("tools/call", {"name": name, "arguments": arguments})
        # MCP returns a content array; extract text
        contents = result.get("content", [])
        return "\n".join(c.get("text", "") for c in contents if c.get("type") == "text")
```

---

## Registering into ToolRegistry: Seamless Fusion with Native Tools

```python
def register_mcp_server(registry: ToolRegistry, mcp_client: MCPClient) -> None:
    """
    Register all tools from an MCP server into ToolRegistry.
    After registration, these tools are identical to native tools —
    the agent gets schemas via get_schemas() and
    executes via dispatch(), unaware whether the backend is MCP or a local function.
    """
    tools = mcp_client.list_tools()

    for tool in tools:
        tool_name = tool["name"]
        tool_schema = {
            "name": tool_name,
            "description": tool["description"],
            "parameters": tool.get("inputSchema", {"type": "object", "properties": {}}),
        }

        # Create a closure capturing mcp_client and tool_name
        def make_handler(client: MCPClient, name: str):
            def handler(**kwargs) -> str:
                return client.call_tool(name, kwargs)
            return handler

        registry.register(
            name=tool_name,
            schema=tool_schema,
            handler=make_handler(mcp_client, tool_name),
        )
```

---

## Scoped Servers: Different Contexts Connect to Different MCP Servers

```python
# hermes_config.json
{
  "mcp_servers": [
    {
      "name": "filesystem",
      "cmd": ["uvx", "mcp-server-filesystem", "/workspace"],
      "scope": "global"        # Available to all sessions
    },
    {
      "name": "postgres",
      "cmd": ["uvx", "mcp-server-postgres", "--db", "mydb"],
      "scope": "project",      # Only available under the current project directory
      "project_dir": "/workspace/myproject"
    }
  ]
}
```

```python
def load_mcp_servers(registry: ToolRegistry, config: dict, cwd: str) -> None:
    for server_cfg in config.get("mcp_servers", []):
        scope = server_cfg.get("scope", "global")
        if scope == "project":
            # Only load under the matching project directory
            if not cwd.startswith(server_cfg.get("project_dir", "")):
                continue
        client = MCPClient(server_cfg["cmd"])
        register_mcp_server(registry, client)
```

---

## The Agent's Perspective: Fully Unified Tools

```python
# run_agent.py (simplified)
registry = ToolRegistry()

# Register native tools
registry.register("bash", BASH_SCHEMA, run_bash)
registry.register("read_file", READ_FILE_SCHEMA, read_file)

# Register MCP tools (into the same registry)
register_mcp_server(registry, MCPClient(["uvx", "mcp-server-filesystem"]))

# The agent is completely unaware during calls
response = client.chat.completions.create(
    model=MODEL,
    messages=messages,
    tools=registry.get_schemas(),  # ← Native + MCP tools mixed together
)

# Dispatch is also transparent
result = registry.dispatch(tool_name, args)
# ← Internally auto-routes: native tools → local function, MCP tools → RPC
```

---

## Code Walkthrough: snippets/h17_mcp_protocol.py

The Code tab for this chapter shows curated snippets from `tools/mcp_tool.py`, focusing on:

1. **JSON-RPC over stdio** — The communication protocol with MCP servers
2. **`register_mcp_server()`** — The key code for dynamic tool registration
3. **Closure capture** — How an independent handler is generated for each MCP tool

---

## Common Misconceptions

**Misconception 1**: MCP tools need a special dispatch path  
→ After registration, MCP tools are identical to native tools. `registry.dispatch()` calls the closure returned by `make_handler()`, which internally calls MCP RPC. The dispatch layer is transparent to this.

**Misconception 2**: MCP servers must be HTTP services  
→ Hermes' MCP implementation uses stdio (inter-process pipes), not HTTP. The MCP protocol supports both stdio and SSE transport; stdio is simpler and requires no port management.

**Misconception 3**: All MCP servers are loaded at startup  
→ Scoped servers are loaded on demand, only launching the corresponding server under matching project directories. This avoids polluting tool schemas with irrelevant tools and reduces token consumption.
