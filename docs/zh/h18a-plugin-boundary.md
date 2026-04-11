# h18a — Plugin Boundary：为什么 plugin 是能力装配层，而不是行为提示层

> 这页是 `h18` 的延伸。主线章节已经讲了 plugin 可以注册工具、hook、命令和 memory provider；这份 bridge doc 要把更底层的边界说透：**plugin 真正扩展的是 agent 的能力装配面，而不是像 skill 那样直接给模型加一段行为提示。**

---

## 先说结论

很多人第一次看到 plugin 和 skill 并列出现时，会感觉它们都在“扩展 agent”。

于是很容易得出一个模糊但危险的理解：

- skill 是轻量插件
- plugin 是高级 skill
- 两者只是实现方式不同

这个理解其实不对。

Hermes 里两者确实都在扩展系统，但扩展的层根本不是同一层：

- **plugin** 扩展的是能力装配层
- **skill** 影响的是模型操作指南层

如果不先把这条线画清楚，后面读 hook、memory provider、slash command 扩展时都会混。

---

## 1. 为什么 plugin 不是“写给模型看的东西”

skill 的核心产物是文本：

- frontmatter
- trigger 条件
- markdown body
- 最终注入到对话里

它直接影响的是模型这一轮“怎么做”。

但 plugin 完全不是这个路径。

plugin 的核心动作是：

- 注册工具
- 注册 hook
- 注册命令
- 注册 memory provider
- 与 runtime 交互

这些动作大多发生在模型开始思考之前。

换句话说，plugin 不是在给模型补提示词，
而是在改变模型所处的工作环境。

所以 plugin 首先是 runtime assembly，不是 prompt engineering。

---

## 2. 为什么说 plugin 扩展的是“能力装配层”

所谓能力装配层，可以理解成：

> agent 在真正运行之前，系统把哪些能力拼装到它身上。

例如：

- 哪些工具被注册进 registry
- 哪些 hook 会在生命周期里触发
- 哪些 CLI 命令可用
- memory backend 从哪里读写

这些都不是模型自己推理出来的，
而是 runtime 在装配阶段就决定好的。

plugin 正是站在这个位置上工作。

所以它不是会话级行为建议，
而是启动期 / 运行期的能力注入接口。

---

## 3. 为什么 PluginContext 很关键

Hermes 没有让插件直接抓核心内部对象乱改，
而是给它一个 `PluginContext` facade。

这件事很重要，因为它说明：

- Hermes 允许扩展
- 但不放弃内部边界控制

也就是说，plugin 虽然能改变系统能力装配，
但它仍然必须通过一个受控接口来完成。

这和 skill 的差异也很明显：

- skill 的边界主要是“注入什么内容”
- plugin 的边界主要是“允许改哪些 runtime surface”

所以 `PluginContext` 不只是方便 API，
它其实就是插件系统边界本身。

---

## 4. 为什么 plugin 能注册 hook，不代表 hook 就等于 plugin

有时读者会再往前混一层：

- plugin 能注册 hook
- 那 hook 不就是插件吗？

也不对。

更准确地说：

- hook 是生命周期插口
- plugin 是完整功能模块
- plugin 可以利用 hook 作为一种扩展手段

所以 hook 和 plugin 是“工具与载体”的关系，
而不是同义词。

这也是为什么 `h14` 和 `h18` 应该连起来看：

- `h14` 解释 hook 能做什么、不能做什么
- `h18` 解释谁可以系统性地利用这些 hook 去扩展能力

---

## 5. 为什么 memory provider 插件最能暴露这条边界

memory provider 是一个非常好的例子。

因为它做的事情完全不是：

- 告诉模型怎么记忆
- 给模型一段关于 memory 的解释

它做的是更底层的事情：

- 把 memory 的存储后端换掉
- 让 runtime 从新的 provider 读写记忆

也就是说，它修改的是系统的结构性能力，而不是模型的行为提示。

这正好说明：

> plugin 扩展的是 runtime substrate，skill 扩展的是 reasoning guidance。

这两者看起来都在“影响行为”，但层次完全不同。

---

## 6. 为什么 plugin 也不能越过控制面边界

虽然 plugin 很强，但它并不意味着可以随意绕过系统边界。

例如一个健康的 plugin 扩展，仍然应该满足：

- 新工具进入统一 registry
- 新 hook 进入统一生命周期
- 新命令进入统一 command surface
- memory provider 仍服从统一 runtime 调用边界

如果插件通过旁路悄悄完成这些事，
那它就不是扩展，而是在制造不可见分叉。

所以 plugin system 的设计目标不是“给你无限改内部”，
而是：

> 在不 fork Hermes 的前提下，给你一套受控的能力装配入口。

这条线非常重要。

---

## 7. 为什么 plugin 和 skill 必须同时存在，而不是二选一

如果只有 skill：

- 你能改变模型的操作方式
- 但不能真正增加新能力

如果只有 plugin：

- 你能增加工具和扩展点
- 但不能细粒度地告诉模型“这次任务应该怎么做”

所以 Hermes 同时保留两者，恰恰说明它在区分两种完全不同的扩展需求：

- **能力扩展**：plugin
- **行为引导**：skill

这不是重复设计，而是层级分工。

---

## 8. 一个很好用的判断法

当你想扩展 Hermes 时，可以先问自己：

### 我要改的是 agent 能做什么？

例如：

- 多一个工具
- 多一个 hook
- 多一个 slash command
- 换一个 memory backend

那应该用 plugin。

### 我要改的是 agent 在这类任务里怎么做？

例如：

- 先做什么，再做什么
- 输出格式偏什么风格
- 什么时候应该走哪个流程

那应该用 skill。

这个判断法很简单，但几乎能挡住大多数边界混淆。

---

## 9. 和主线章节怎么连起来

推荐这样串读：

- `h08`：先理解 skill 是操作指南，不是 system prompt 延长线
- `h14`：再理解 hook 是 lifecycle 插口，而不是控制流接管点
- `h18`：然后看 plugin 如何系统性利用 tool / hook / command / memory provider 去扩展 Hermes
- 这页：最后把 plugin 与 skill 的层级边界彻底校准

---

## 10. 这页最该带走的一句话

Plugin 扩展的是 agent 的能力装配面：它改变的是 runtime 给模型准备了什么工作环境；而 skill 扩展的是模型的行为提示面：它改变的是模型在当前任务里该怎么做。

两者都在扩展 Hermes，但绝不是同一种扩展。
