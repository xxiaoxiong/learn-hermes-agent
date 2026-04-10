# h17 — MCP Integration：外部工具与原生工具共用同一注册表

> **核心洞察**：MCP 工具不是"外挂"——它进入同一个注册表，走同一条 dispatch 路径，agent 看不出区别。

---

## 什么是 MCP？

**Model Context Protocol (MCP)** 是 Anthropic 提出的开放协议，让 AI agent 能够动态发现和调用外部工具服务。

MCP server 是独立进程，通过 JSON-RPC over stdio 与 agent 通信：

```
agent (client)          MCP server (外部进程)
     │                       │
     │─── initialize ────────→│
     │←── capabilities ───────│
     │─── tools/list ─────────→│
     │←── [tool1, tool2, ...] ─│
     │─── tools/call ──────────→│
     │←── tool result ──────────│
```

---

## 动态工具发现：握手 → 注册

```python
import subprocess
import json

class MCPClient:
    def __init__(self, server_cmd: list[str]):
        """启动 MCP server 进程（stdin/stdout 通信）"""
        self.proc = subprocess.Popen(
            server_cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            text=True,
        )
        self._id = 0

    def _rpc(self, method: str, params: dict | None = None) -> dict:
        """发送 JSON-RPC 请求，等待响应"""
        self._id += 1
        req = {"jsonrpc": "2.0", "id": self._id, "method": method, "params": params or {}}
        self.proc.stdin.write(json.dumps(req) + "\n")
        self.proc.stdin.flush()
        line = self.proc.stdout.readline()
        return json.loads(line)["result"]

    def list_tools(self) -> list[dict]:
        """获取 MCP server 提供的工具列表"""
        result = self._rpc("tools/list")
        return result.get("tools", [])

    def call_tool(self, name: str, arguments: dict) -> str:
        """调用 MCP server 的工具"""
        result = self._rpc("tools/call", {"name": name, "arguments": arguments})
        # MCP 返回 content 数组，提取文本
        contents = result.get("content", [])
        return "\n".join(c.get("text", "") for c in contents if c.get("type") == "text")
```

---

## 注册到 ToolRegistry：与原生工具无缝融合

```python
def register_mcp_server(registry: ToolRegistry, mcp_client: MCPClient) -> None:
    """
    把 MCP server 的所有工具注册到 ToolRegistry。
    注册后，这些工具和原生工具完全一样——
    agent 通过 get_schemas() 获取 schema，
    通过 dispatch() 执行，不知道背后是 MCP 还是本地函数。
    """
    tools = mcp_client.list_tools()

    for tool in tools:
        tool_name = tool["name"]
        tool_schema = {
            "name": tool_name,
            "description": tool["description"],
            "parameters": tool.get("inputSchema", {"type": "object", "properties": {}}),
        }

        # 创建闭包，捕获 mcp_client 和 tool_name
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

## Scoped Servers：不同上下文连接不同 MCP server

```python
# hermes_config.json
{
  "mcp_servers": [
    {
      "name": "filesystem",
      "cmd": ["uvx", "mcp-server-filesystem", "/workspace"],
      "scope": "global"        # 所有会话都可用
    },
    {
      "name": "postgres",
      "cmd": ["uvx", "mcp-server-postgres", "--db", "mydb"],
      "scope": "project",      # 仅当前项目目录下可用
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
            # 仅在匹配的项目目录下加载
            if not cwd.startswith(server_cfg.get("project_dir", "")):
                continue
        client = MCPClient(server_cfg["cmd"])
        register_mcp_server(registry, client)
```

---

## agent 视角：工具完全统一

```python
# run_agent.py（简化）
registry = ToolRegistry()

# 注册原生工具
registry.register("bash", BASH_SCHEMA, run_bash)
registry.register("read_file", READ_FILE_SCHEMA, read_file)

# 注册 MCP 工具（进入同一个注册表）
register_mcp_server(registry, MCPClient(["uvx", "mcp-server-filesystem"]))

# agent 调用时完全无感
response = client.chat.completions.create(
    model=MODEL,
    messages=messages,
    tools=registry.get_schemas(),  # ← 原生 + MCP 工具混在一起
)

# dispatch 时也无感
result = registry.dispatch(tool_name, args)
# ← 内部自动路由：原生工具走本地函数，MCP 工具走 RPC
```

---

## 代码解读：snippets/h17_mcp_protocol.py

本章 Code 标签展示 `tools/mcp_tool.py` 的精选片段，关注：

1. **JSON-RPC over stdio** — 与 MCP server 的通信协议
2. **`register_mcp_server()`** — 动态工具注册的关键代码
3. **闭包捕获** — 如何为每个 MCP 工具生成独立的 handler

---

## 常见误区

**误区 1**：MCP 工具需要特殊的 dispatch 路径  
→ MCP 工具注册后与原生工具完全一样。`registry.dispatch()` 调用的是 `make_handler()` 返回的闭包，闭包内部调用 MCP RPC。dispatch 层对此透明。

**误区 2**：MCP server 必须是 HTTP 服务  
→ Hermes 的 MCP 实现用 stdio（进程间管道），不是 HTTP。MCP 协议支持 stdio 和 SSE 两种传输方式，stdio 更简单，无需端口管理。

**误区 3**：所有 MCP server 都在启动时加载  
→ scoped server 按需加载，仅在匹配的项目目录下启动对应 server。避免不相关工具污染 tool schema，减少 token 消耗。
