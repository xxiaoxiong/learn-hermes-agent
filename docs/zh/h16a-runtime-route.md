# h16a — Runtime Route：为什么 provider runtime 真正统一的不是“厂商名”，而是 turn 级路由结果

> 这页是 `h16` 的延伸。主线章节已经讲了 `(provider, model) → api_mode` 的映射；这份 bridge doc 要把更深一层的运行时视角讲清楚：**Hermes 真正稳定的抽象，不是“我在用哪个 provider”，而是“这一轮调用最终被路由成什么样的 runtime route”。**

---

## 先说结论

很多人第一次理解 provider runtime，会把注意力放在：

- 这是 OpenAI 还是 Anthropic
- 这是 OpenRouter 还是 Ollama
- 这是官方接口还是兼容接口

这些当然重要，但在 Hermes 内部，更关键的问题其实是：

- 这一轮到底走哪一种 API mode
- 使用哪一组 key / base_url
- 失败后下一轮会切到哪条路

也就是说，系统真正依赖的不是 provider 名字本身，而是一次调用在 runtime 里被解析出的那份**路由结果**。

---

## 1. 为什么“按厂商写 if-else”很容易越写越乱

直觉上，最简单的方式当然是：

- OpenAI 走一套
- Anthropic 走一套
- OpenRouter 走一套
- 本地模型再走一套

但只要系统开始变复杂，你很快就会撞上这些问题：

- 同一 provider 可能支持不止一种调用模式
- 同一个模型可能因为 `base_url` 不同而该走不同路径
- fallback 后 provider 变了，整套分支逻辑又得重跑
- credential pool、不同账号、不同 endpoint 也要一起参与决策

这时候如果抽象还停留在“厂商名”，runtime 就会变成一个不断膨胀的分支森林。

---

## 2. Hermes 真正统一的是 turn 级 runtime route

更合理的理解方式是把一次调用压缩成一份标准运行时结果，例如：

- `provider`
- `api_mode`
- `base_url`
- `api_key`
- `source`

这份结果才是 agent 真正消费的对象。

也就是说，AIAgent 不需要知道：

- 你是从 env 推出来的
- 还是从 config 显式指定的
- 还是从 credential pool 轮询出来的
- 还是 fallback 后临时切换过来的

它只需要拿到一份已决议完成的 route，然后按 route 执行。

所以 provider runtime 的核心工作不是“识别厂商”，而是“在 turn 开始前把这轮调用裁决成一条明确路径”。

---

## 3. 为什么 api_mode 比 provider 名更接近真正分支点

从 agent loop 的角度看，真正影响调用代码路径的关键通常不是厂商，而是：

- `chat_completions`
- `anthropic_messages`
- `codex_responses`

因为最终分支是沿着这些 API mode 发生的。

换句话说：

- provider 是来源标签
- api_mode 才是执行方言

如果你只盯着 provider，很容易误以为“换厂商 = 换整个 runtime 架构”。
但 Hermes 把问题重新压平了：

> 不管上游是谁，只要最后能解析到统一 route，agent loop 就可以保持不变。

这也是为什么 `api_mode` 会成为 runtime 里的核心判定字段。

---

## 4. 为什么 route 必须是“每轮重新解析”的

一个很常见的误解是：

- provider 在启动时确定一次就够了

但 Hermes 不是静态单路系统，它会遇到：

- fallback provider 切换
- token / key 轮询
- 不同辅助任务使用不同 route
- 某些 base_url 推断出的 mode 与主模型不同

这意味着 runtime route 不是“进程启动配置”，而更像：

> 当前这一轮调用之前，系统对执行路径做出的即时裁决。

所以 route 的粒度天然应该是 turn 级，而不是 app 级。

一旦这样理解，很多现象就顺了：

- 为什么 fallback 后 agent 不需要重写主循环
- 为什么 auxiliary 调用可能走不同 provider
- 为什么 credential pool 不只是配置，而是运行时分配器

---

## 5. 为什么 credential pool 也应该被看成 route 的一部分

很多人会把 credential pool 理解成一个很边缘的“账号轮换功能”。

但如果你从 runtime route 视角看，它其实不是外围小功能，而是 route 决议的一部分。

因为同一个 provider：

- 哪个 key 被选中
- 对应哪个 runtime_base_url
- 来自哪个 source

这些都直接影响这轮调用的真实执行路径。

也就是说，Hermes 不是先固定 provider，再随便挑个 key；
而是把 provider、mode、base_url、credential 一起解析成同一份 route。

所以 credential pool 更像 route assembler，而不是简单的“账号列表”。

---

## 6. 为什么 fallback 本质上是在重算 route，而不是“换个模型试试”

主线里我们已经知道：失败后可以 retry，也可以 fallback。

但如果从 runtime 角度再往下一层看，fallback 真正做的事情其实是：

- 重新选择 provider / model
- 重新解析 api_mode
- 重新解析 credential
- 最终得到一条新的 runtime route

所以 fallback 不是在原路上强行再试一次，
而是：

> 换一条新的 route，把同一个任务继续往前推进。

这样你就能更清楚地区分：

- retry：同一路径重试
- fallback：换一条新路径继续

这正是 `h10` 和 `h16` 之间最值得连起来理解的地方。

---

## 7. 为什么“统一 route”也是多平台能力的基础

provider runtime 看起来像模型接口层问题，
但它和更上层的平台能力其实是连在一起的。

因为无论请求来自：

- CLI
n- Gateway
- cron
- subagent
- plugin 注入的额外调用

最终只要落到 AIAgent 执行，就还是要解析 route。

这说明 route abstraction 不是某个 provider 子模块的局部技巧，
而是整个平台 runtime 的通用接口。

平台入口可以不同，但真正往模型发请求前，大家都要先被压平到同一种 route 语言里。

---

## 8. 什么时候最该回到这页看

这页特别适合在以下时刻回看：

### 当你觉得 provider 配置越来越多

说明你可能还在按“厂商列表”思考，而不是按“统一 route 结果”思考。

### 当你开始做 fallback / auxiliary routes

这时最容易看清：不同调用路径的共通抽象其实是 route，而不是 provider 名。

### 当你想接新 provider 却不想动主循环

这正是这页的核心结论：
新 provider 只要能被解析成统一 route，就没必要改 agent loop。

---

## 9. 和主线章节怎么连起来

推荐这样串读：

- `h10`：先理解 retry、fallback、continuation 是不同层级的补救动作
- `h16`：再看 provider runtime 如何把模型调用压平到三种 API mode
- 这页：进一步看清 Hermes 真正统一的抽象是 turn 级 route，而不是 provider 名字
- `h17` / `h18`：之后再看插件和外部能力接入，就更容易理解为什么 runtime 需要保持统一消费面

---

## 10. 这页最该带走的一句话

Hermes 里真正稳定的不是“我在用哪个 provider”，而是每一轮调用开始前被解析出来的那条 runtime route。

provider 可以变化，credential 可以轮换，fallback 可以改道；但只要 route 结果仍然统一，agent loop 就不用跟着变化。
