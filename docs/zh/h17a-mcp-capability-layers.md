# h17a — MCP Capability Layers：为什么 MCP 不只是“外部工具接入”

> 这页是 `h17` 的延伸。主线章节已经讲了 MCP 工具如何进入同一注册表；这份 bridge doc 要补上更完整的平台视角：**MCP 不只是外部工具目录，它其实是一组能力层，而 tools 只是最先进入主线的那个切面。**

---

## 先说结论

很多人第一次学 MCP，会把它理解成：

- 启动一个外部 server
- 拉到一批工具
- 注册进 registry
- 像原生工具一样调用

这样理解没有错，但它只抓住了 MCP 最容易上手的那一层。

如果你继续往真实系统里走，很快会碰到：

- server 怎么连接
- 为什么有的 server 已连接，有的还在 pending
- 为什么有的需要认证
- tools 之外为什么还有 resources、prompts、elicitation

这时候如果心智模型里仍然只有“外部工具接入”，MCP 就会越学越散。

---

## 1. 为什么主线应该坚持 tools-first

教学上先讲 tools 是对的，因为它和前面章节衔接最自然：

- 本地工具
- 外部工具
- 同一条 dispatch 路径

这条主线能最快让读者建立起：

> MCP 工具进入同一注册表以后，对 agent 来说就和原生工具没有本质区别。

但如果停在这一步，也会留下一个隐患：

- 读者会误以为 MCP 就只是一种 tool transport

所以 bridge doc 的任务不是推翻主线，而是补充：

- tools-first 是入口
- capability layers 才是更完整的平台视角

---

## 2. 什么叫 capability layer

所谓 capability layer，可以理解成：

> 不把 MCP 的所有细节混成一团，而是按职责拆成几层能力面。

一个很实用的最小分层方式是：

1. **Config Layer** —— server 配置从哪里来，长什么样
2. **Transport Layer** —— 用 stdio / HTTP / streamable transport 怎么连
3. **Connection State Layer** —— 当前是 connected / pending / failed / needs-auth
4. **Capability Layer** —— tools / resources / prompts / elicitation
5. **Auth Layer** —— 是否需要 OAuth / token / 其他授权流程
6. **Router Integration Layer** —— 最后怎样接回 registry、permission、notification

一旦你有了这张图，就不会再把 MCP 只看成一个“会返回工具列表的黑盒”。

---

## 3. 为什么 tools 只是 capability layer 的一部分

Hermes 主线里最关心的是 tools，原因很简单：

- tool schema 能直接进入模型可见能力面
- dispatch 路径最容易复用
- 用户最容易感受到“外部能力已经接进来了”

但从平台角度看，MCP 真正暴露的并不一定只有 tools。

还有一些能力虽然在当前教学主线里不会详细展开，但你需要知道它们的位置：

- **resources**：外部上下文资源
- **prompts**：服务器侧可复用提示片段
- **elicitation**：server 反向请求额外输入

这意味着 MCP 不是“工具协议”这么窄，
而是“外部能力平台协议”。

---

## 4. 为什么 connection state 不能和 capability 暴露混在一起

另一个很常见的混淆是：

- server 配置好了
- 工具就应该已经可用

但在真实系统里，中间其实隔着一个连接状态层。

也就是说，server 至少可能处于：

- `connected`
- `pending`
- `failed`
- `needs-auth`
- `disabled`

而 capability 的暴露，必须建立在连接状态足够健康的前提上。

这层一旦没想清楚，就会出现很多错误理解：

- 为什么配置存在但工具列表还是空的
- 为什么有的 server 没注册成功
- 为什么认证没完成时工具不能暴露给 agent

所以“能不能用”首先是 connection state 问题，其次才是 capability integration 问题。

---

## 5. 为什么 auth layer 不该一开始就塞进主线

MCP 的真实世界里，认证当然很重要。

但如果正文一上来就沉进：

- OAuth callback
- token refresh
- 第三方授权状态
- XAA / external auth handshake

初学者会立刻丢掉主线。

所以更好的教学顺序应该是：

- 先让读者知道 auth layer 存在
- 再让读者知道它会影响 connection state
- 只有到了平台层深化时，才详细讲认证流程

这也是 bridge doc 很适合承担的角色：

> 不打断主线，但提前把完整地图立起来。

---

## 6. 为什么 router integration 才决定 MCP 最终算不算“接进系统”

Hermes 接入 MCP 的真正关键，并不只是“能连上 server”。

更关键的是：

- list_tools 拿回来的 schema 是否进入统一 registry
- 调用是否仍然经过 permission / approval / logging 边界
- 工具结果是否仍然回到同一条 tool_result 流程

也就是说，MCP 真正进入系统，不是发生在 transport 层，
而是发生在 integration 层。

如果某个外部能力绕开了这层统一接入，你得到的就不是能力扩展，
而是系统边缘偷偷长出来的一条旁路。

所以这页最重要的一条线其实是：

> capability 可以来自外部，但 control plane 不能分叉。

---

## 7. 为什么这页和 h02 / h09 / h18 都会连起来

这页虽然挂在 `h17` 下面，但它天然会和很多章节发生联动：

### 和 `h02`

因为外部 MCP 工具最后还是要回到同一注册表逻辑里，
否则就无法共享 schema、dispatch、tool_result 的统一抽象。

### 和 `h09`

因为外部工具如果绕过 permission，就会在系统边缘开后门。

### 和 `h18`

因为 plugin system 也是一种扩展面，但它扩展的是本地能力装配；
而 MCP 扩展的是远端 capability surface。

这两者很容易混，但它们所在层级并不一样。

---

## 8. 一个很实用的判断法

当你在看某个 MCP 设计时，可以先问：

### 它是在描述连接问题？

那它属于 transport / connection state / auth layer。

### 它是在描述暴露什么能力？

那它属于 capability layer。

### 它是在描述怎样进入 Hermes 统一控制面？

那它属于 router integration layer。

这个判断法非常有用，因为它能防止你把：

- server 配置
- 连接状态
- 工具列表
- 权限接入

全讲成同一件事。

---

## 9. 和主线章节怎么连起来

推荐这样串读：

- `h17`：先理解 MCP 工具如何进入同一条 registry / dispatch 路径
- 这页：再补上 MCP 其实是一组 capability layers，而不只是工具目录
- `h18`：之后再看 plugin system，就更容易分清“本地扩展面”和“远端能力面”的差别

---

## 10. 这页最该带走的一句话

MCP 不只是“把外部工具接进来”，而是一组从配置、连接、认证到能力暴露再到统一接入控制面的能力层。

tools 只是最先进入主线、也最容易教学的那一层，但绝不是全部。
