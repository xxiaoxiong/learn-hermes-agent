# h02 — Tool System：注册表解耦 schema 与 handler

> **核心洞察**：tool schema 是给模型的说明书，handler 是给代码的执行器——两者分离，才能"不改主循环添新工具"。

---

## 问题：h01 的工具系统有什么不足？

在 h01 里，`_dispatch()` 方法是这样写的：

```python
def _dispatch(self, tool_call) -> str:
    name = tool_call.function.name
    args = json.loads(tool_call.function.arguments)
    if name == "bash":
        return run_bash(args["command"])
    return f"[未知工具: {name}]"
```

每次添加新工具，都要改 `_dispatch()` 里的 if-else 链。工具定义（`TOOLS` 列表）和执行逻辑（`_dispatch`）散落两处，容易遗漏同步。

**更根本的问题**：主循环和工具系统耦合在一起。主循环应该永远不变，变的是工具集合。

---

## 解决方案：ToolRegistry

```python
class ToolRegistry:
    def __init__(self):
        self._handlers: dict[str, Callable] = {}  # name → handler 函数
        self._schemas: dict[str, dict] = {}        # name → JSON Schema

    def register(self, name: str, schema: dict, handler: Callable) -> None:
        """一次性绑定 schema 和 handler"""
        self._schemas[name] = {"type": "function", "function": schema}
        self._handlers[name] = handler

    def get_schemas(self) -> list[dict]:
        """返回所有 schema（传给 API 的 tools 参数）"""
        return list(self._schemas.values())

    def dispatch(self, name: str, args: dict) -> ToolResult:
        """执行工具，捕获所有异常不中断循环"""
        if name not in self._handlers:
            return ToolResult(success=False, content=f"未知工具: {name}")
        try:
            result = self._handlers[name](**args)
            return ToolResult(success=True, content=str(result))
        except Exception as e:
            return ToolResult(success=False, content=f"工具执行失败: {e}")
```

---

## 关键数据结构

### ToolSchema

每个工具的 JSON Schema 告诉模型：这个工具叫什么名字、做什么、需要什么参数。

```python
{
    "type": "function",
    "function": {
        "name": "read_file",
        "description": "读取本地文件内容",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "文件路径"}
            },
            "required": ["path"],
        },
    },
}
```

### ToolResult

工具执行结果的统一封装：

```python
class ToolResult:
    def __init__(self, success: bool, content: str):
        self.success = success
        self.content = content

    def __str__(self) -> str:
        prefix = "" if self.success else "[ERROR] "
        return prefix + self.content
```

**设计要点**：工具失败时返回 `ToolResult(success=False, ...)` 而不是抛出异常。失败信息以字符串形式回流给模型，让模型决定如何处理（重试、换方案、报告错误）。

### Dispatch Map

```
registry._schemas["read_file"] → JSON Schema（供 get_schemas() 返回给 API）
registry._handlers["read_file"] → _read_file 函数（供 dispatch() 执行）
```

两个 dict，同一个 `name` 为键，这就是"分离"的实现。

---

## 添加工具：只需 3 行

```python
registry = build_default_registry()  # 初始化含 3 个工具的注册表

# ← 添加一个新工具，主循环代码完全不动
registry.register(
    "get_time",
    {
        "name": "get_time",
        "description": "返回当前时间（ISO 格式）",
        "parameters": {"type": "object", "properties": {}},
    },
    lambda: datetime.datetime.now().isoformat(),
)
```

主循环里的关键调用变成：

```python
# 之前（h01）：硬编码 if-else
result = self._dispatch(tool_call)

# 之后（h02）：委托给注册表
args = json.loads(tc.function.arguments)
result = self.registry.dispatch(tc.function.name, args)
```

**主循环代码一行未变**（只改了 `_dispatch` 的实现细节）。

---

## 与 Hermes 真实代码的对应

Hermes 的 `tools/registry.py` 和教学版的 `ToolRegistry` 结构几乎一致：

| 教学实现 | Hermes 源码 | 说明 |
|---|---|---|
| `ToolRegistry` | `ToolRegistry` | 同名类，同样的 dispatch map |
| `registry.register()` | `registry.register()` | 相同接口 |
| `registry.get_schemas()` | `registry.get_schemas()` | 相同接口 |
| `registry.dispatch()` | `registry.dispatch()` | Hermes 版增加了 approval 拦截（h09） |
| `ToolResult` | `ToolResult` | 相同结构 |

Hermes 的工具注册采用**自注册模式**：每个工具文件在模块加载时自动调用 `registry.register()`，不需要中央汇总列表。例如：

```python
# tools/bash_tool.py 末尾
registry.register("bash", BASH_SCHEMA, run_bash)

# tools/read_file_tool.py 末尾  
registry.register("read_file", READ_FILE_SCHEMA, read_file)
```

只要导入这些模块，工具就自动注册进去了。

---

## 常见误区

**误区 1**：schema 里的 `description` 无所谓  
→ `description` 是模型决定"何时、如何"使用这个工具的主要依据。写得不清楚，模型会误用或不用。

**误区 2**：工具 handler 应该自己处理错误并抛异常  
→ 工具异常不应该传播到主循环。`registry.dispatch()` 的 `try-except` 确保所有错误都转换为 `[ERROR]` 字符串，让模型决策。

**误区 3**：需要给每个工具写一个单独的 class  
→ handler 就是普通函数，`**args` 解包 JSON 参数即可。类只在 handler 需要维护状态时才有意义。

---

## 动手练习

1. 运行 `python agents/h02_tool_system.py`，观察三个内置工具的协作
2. 添加一个 `list_dir` 工具（用 `os.listdir(path)`），不改 `AIAgent` 的任何代码
3. 故意让 handler 抛出异常，观察模型如何响应 `[ERROR]` 消息
