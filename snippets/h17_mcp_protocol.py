# ============================================================
# H17: MCP Protocol — Hermes Real Source Snippets
# Source: tools/mcp_tool.py
#
# 核心洞察：MCP 是工具的工具
# MCP 服务器暴露工具；hermes 的 mcp_tool 把这些工具动态注册进
# tools.registry，使 agent 可以像调用内置工具一样调用它们。
# MCP 工具在 agent 看来和 bash_tool / read_file 没有区别。
# ============================================================


# ── tools/mcp_tool.py: 1-70 — architecture overview ─────────────────────────
"""
MCP (Model Context Protocol) Client Support

Connects to external MCP servers via stdio or HTTP/StreamableHTTP transport,
discovers their tools, and registers them into the hermes-agent tool registry
so the agent can call them like any built-in tool.

Architecture:
    A dedicated background event loop (_mcp_loop) runs in a daemon thread.
    Each MCP server runs as a long-lived asyncio Task on this loop, keeping
    its transport context alive. Tool call coroutines are scheduled onto the
    loop via run_coroutine_threadsafe().

    On shutdown, each server Task is signalled to exit its async with block,
    ensuring the anyio cancel-scope cleanup happens in the *same* Task that
    opened the connection (required by anyio).

Thread safety:
    _servers and _mcp_loop/_mcp_thread are protected by _lock.
"""

# ── tools/mcp_tool.py: config example ──────────────────────────────────────
# ~/.hermes/config.yaml — mcp_servers section
MCP_CONFIG_EXAMPLE = """
mcp_servers:
  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    timeout: 120
    connect_timeout: 60
  github:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_PERSONAL_ACCESS_TOKEN: "ghp_..."
  remote_api:
    url: "https://my-mcp-server.example.com/mcp"
    headers:
      Authorization: "Bearer sk-..."
    timeout: 180
"""


# ── tools/mcp_tool.py: ~200-350 — dynamic tool registration ─────────────────
def initialize_mcp_servers(mcp_config: dict, task_id: str = None) -> int:
    """Connect to configured MCP servers and register their tools.

    Called once during agent init. Returns the number of tools registered.

    For each server:
    1. Start a background thread with a dedicated asyncio event loop
    2. Connect to the server (stdio subprocess or HTTP)
    3. Call server.list_tools() to discover available tools
    4. Dynamically register each tool into the hermes tool registry

    KEY: after this call, MCP tools are indistinguishable from built-in tools.
    The agent calls them by name, the registry routes to the MCP handler.
    """
    import asyncio
    import threading
    from tools.registry import registry

    if not _MCP_AVAILABLE:
        logger.debug("MCP SDK not available; skipping MCP server init")
        return 0

    registered_count = 0
    for server_name, server_cfg in mcp_config.items():
        try:
            # Launch background task: connect + discover tools
            future = asyncio.run_coroutine_threadsafe(
                _connect_and_discover(server_name, server_cfg),
                _mcp_loop,
            )
            tool_schemas = future.result(timeout=server_cfg.get("connect_timeout", 60))

            for schema in tool_schemas:
                mcp_name = schema["name"]
                # Register with a bound handler that routes to the MCP server
                registry.register(
                    name=mcp_name,
                    toolset="mcp",
                    schema=schema,
                    handler=lambda args, _n=mcp_name, _s=server_name: _call_mcp_tool(_s, _n, args),
                )
                registered_count += 1

            logger.info("MCP server '%s': registered %d tools", server_name, len(tool_schemas))
        except Exception as e:
            logger.warning("MCP server '%s' failed to initialize: %s", server_name, e)

    return registered_count


# ── tools/mcp_tool.py: ~450-550 — tool call routing ─────────────────────────
def _call_mcp_tool(server_name: str, tool_name: str, args: dict) -> str:
    """Call an MCP tool and return the result as a JSON string.

    Runs on the calling thread; the coroutine executes on the MCP background loop.
    Applies configurable timeout and strips credentials from error messages.
    """
    if not _MCP_AVAILABLE:
        return json.dumps({"error": "MCP SDK not available"})

    server = _servers.get(server_name)
    if not server or not server.get("session"):
        return json.dumps({"error": f"MCP server '{server_name}' not connected"})

    timeout = server.get("config", {}).get("timeout", 120)

    try:
        future = asyncio.run_coroutine_threadsafe(
            server["session"].call_tool(tool_name, args),
            _mcp_loop,
        )
        result = future.result(timeout=timeout)

        # Convert MCP result format → plain string for the agent
        if hasattr(result, "content"):
            text_parts = [c.text for c in result.content if hasattr(c, "text")]
            return json.dumps({"result": "\n".join(text_parts)})
        return json.dumps({"result": str(result)})

    except TimeoutError:
        return json.dumps({"error": f"MCP tool '{tool_name}' timed out after {timeout}s"})
    except Exception as e:
        # Strip credentials from error message before returning to LLM
        clean_error = _strip_credentials_from_error(str(e))
        return json.dumps({"error": f"MCP tool '{tool_name}' failed: {clean_error}"})
