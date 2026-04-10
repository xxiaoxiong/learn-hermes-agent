# h04a — Prompt Caching：为什么稳定前缀比“把所有信息都塞进 system prompt”更重要

> 这页是 `h04` 的延伸。主线章节讲了 PromptBuilder 如何把 prompt 组装成 5 层 section；这份 bridge doc 要解释另一个关键问题：**为什么 Hermes 会如此强调 prompt 的前缀稳定性，以及这件事为什么直接影响 skill 注入策略。**

---

## 先说结论

在支持 prompt caching 的模型链路里，system prompt 不是越灵活越好，而是要尽量做到：

- 前半部分稳定
- 高频变化内容后置
- 临时任务说明不要轻易污染前缀

Hermes 把 `personality`、`memory` 这类相对稳定的内容放在前面，把更容易变化的内容后置，核心目标就是：

**让每轮请求都尽可能复用已经缓存过的 prompt 前缀。**

---

## 1. 什么叫 prompt cache 命中

你可以先用很朴素的方式理解：

- 如果每轮请求前半段 prompt 几乎一样
- 模型服务端就有机会复用之前已经处理过的那部分
- 这样可以减少重复计算，降低延迟和成本

反过来，如果你每轮都改动 prompt 最前面的一大段内容，那么即使后面 90% 都一样，也可能失去缓存收益。

所以对于支持 caching 的模型，prompt 不是单纯“语义正确”就够了，还要关注**结构稳定性**。

---

## 2. 为什么最前面的内容最值钱

PromptBuilder 里 section 有顺序，不只是为了阅读整齐。

它还隐含一个性能策略：

- 越前面的 section，越应该稳定
- 越后面的 section，越可以承载动态内容

这也是为什么 `personality`、`memory` 会被放得更靠前：

- 它们在多轮对话里相对稳定
- 一旦进入缓存，就能被反复复用

而像：

- 当前目录上下文
- 临时任务说明
- 某轮专用的 skill

这类内容变化频率高，如果混进 prompt 前缀，会不断打断缓存复用。

---

## 3. 为什么“把 skill 直接塞进 system prompt”是个危险诱惑

从功能上看，把 skill 放进 system prompt 当然能工作。

而且它甚至看起来很自然：

- skill 不就是规则吗？
- 规则不就该放 system prompt 吗？

但问题在于，skill 往往是**任务相关、会频繁切换**的：

- 这次需要 code review skill
- 下次需要 browser automation skill
- 再下一次又需要 docx skill

如果这些内容每次都直接改 system prompt 前缀，缓存命中率会很快变差。

所以 Hermes 把 skill 设计成通过 `user message` 注入，而不是直接并进 system prompt。这样做的效果是：

- system prompt 主体保持稳定
- 技能说明仍然能进入当前回合上下文
- 临时任务方法不会污染高价值的缓存前缀

---

## 4. PromptBuilder 的“顺序设计”其实是性能设计

在 `h04` 里你看到的是 section priority；在运行时它还意味着另一层东西：

| 位置 | 内容类型 | 目标 |
|---|---|---|
| 最前面 | personality | 长期稳定、适合缓存 |
| 前中部 | memory | 相对稳定、适合缓存 |
| 中后部 | skills / context files | 较动态，尽量后置 |
| 最后面 | tool guidance / 其他运行时提示 | 可读性和完整性补充 |

这不是说后面的内容不重要，而是说：

**重要性和稳定性不是同一个维度。**

一个内容可能非常重要，但如果变化太频繁，就不适合放在缓存前缀最前面。

---

## 5. 为什么 prompt caching 会反过来影响架构设计

很多人会以为缓存只是一个“部署优化细节”。

但在 Hermes 这种长期运行的 agent 系统里，它会反过来影响上层设计，例如：

- prompt section 的切分方式
- memory 内容如何组织
- skill 到底放 system prompt 还是 user message
- 动态上下文是否独立后置

也就是说，**运行成本和延迟约束，会倒逼 prompt 架构本身变得更有层次。**

这也是为什么 `h04` 和 `h08` 其实是一组联动章节：

- `h04` 讲结构
- `h08` 讲 skill 注入策略
- 两者中间的桥梁，就是 prompt cache

---

## 6. 不要把“前缀稳定”误解成“system prompt 永远不变”

Hermes 追求的不是绝对静态，而是：

- 尽量让大部分高优先级内容稳定
- 把变化集中到后面几层
- 把最频繁变化的说明迁移到别的注入面

这是一种工程上的“局部稳定”，不是宗教式的“完全不改”。

只要前缀的大块内容足够稳定，缓存收益往往就已经很明显。

---

## 7. 什么时候应该怀疑你的 prompt 设计正在破坏缓存

如果你出现下面这些情况，就该警惕：

- 每轮都把大量任务说明写进 system prompt 最前面
- skill 内容随着任务切换而频繁替换 system prompt
- 当前工作目录、时间戳、临时状态被提前注入到 prompt 开头
- 你发现功能都对，但请求延迟和成本始终偏高

这时候问题可能不在模型质量，而在 prompt 的结构稳定性。

---

## 8. 这页和主线怎么连

这页 bridge doc 最好和主线这样一起看：

- 先读 `h04`：知道 prompt 不是大字符串，而是 section 集合
- 再读这页：理解为什么 section 的顺序与稳定性直接影响 caching
- 然后读 `h08`：就会明白 skill 注入成 user message 不是随便挑的实现，而是和缓存策略强绑定的设计决定

---

## 9. 这页最该带走的一句话

在支持 prompt caching 的 agent 系统里，prompt 结构不只是“怎么表达规则”，更是“怎么避免每轮都重新支付同样的上下文成本”。

所以 Hermes 不是简单地把所有信息塞进 system prompt，而是有意识地保护它的稳定前缀。
