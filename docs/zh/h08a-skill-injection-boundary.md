# h08a — Skill Injection Boundary：为什么 skill 是操作指南，而不是 system prompt 的延长线

> 这页是 `h08` 的延伸。主线章节已经解释了 skill 为什么用 user message 注入；这份 bridge doc 继续把边界往前推一步：**skill 和 system prompt、memory、plugin 看起来都在“影响 agent 行为”，但它们作用的层级完全不同。**

---

## 先说结论

Skill 最准确的定位不是“再加一层人格”，也不是“把系统规则写得更长”。

它更像：

**面向某类任务临时加载的一份操作指南。**

所以 skill 最重要的边界不是它写成了 markdown，而是：

- 它是按任务激活的
- 它是会切换的
- 它不应该污染高稳定度的 system prompt 主体

---

## 1. 为什么 skill 最容易被误当成 system prompt 的延长线

从表面看，skill 里也写规则：

- 应该怎么做
- 先做什么后做什么
- 哪些坑要避免

而 system prompt 不也在写规则吗？

所以最自然的误解就是：

> skill 不就是 system prompt 里没写下的那部分补充规则？

这个想法的问题在于，它只看到了“都是文字说明”，却没看到它们的**生命周期和稳定性**完全不一样。

---

## 2. system prompt 管的是长期高优先级行为边界

system prompt 更像整个 agent 的基础运行宪法。

它通常负责：

- 角色身份
- 安全边界
- 协作方式
- 工具使用总原则
- 输出风格的高优先级约束

这些内容的特点是：

- 长时间稳定
- 适用于绝大多数任务
- 不应该因为本轮任务换了主题就大幅改写

而 skill 恰恰相反：

- 它常常只在某类任务里有用
- 它会随着任务切换而更换
- 它强调的是“怎么做这类事”，不是“你是谁”

---

## 3. skill 和 memory 也不是一回事

另一种常见混淆是把 skill 当成 memory。

但两者的关键区别很清楚：

- memory 保存的是状态、偏好、长期事实
- skill 保存的是方法、步骤、操作建议

例如：

- “用户偏好简洁回答” → memory
- “做代码审查时优先看安全和边界条件” → skill

一个在回答“记住了什么”，另一个在回答“该怎么做”。

---

## 4. skill 和 plugin 也不能混

如果把 skill 和 plugin 也看成一类，就更容易在架构上打结。

因为 plugin 扩展的是：

- 工具
- hook
- 命令
- provider 等真实能力接口

skill 扩展的则是：

- 对某类任务的行为指导
- 对步骤、检查项和注意事项的补充

所以 plugin 更像“给 agent 增加手脚”，skill 更像“给 agent 一份当前任务的作业说明”。

---

## 5. 为什么 user message 注入恰好体现了这个边界

Hermes 没有把 skill 塞进 system prompt，而是把它放到 user message 侧，这其实正好反映了它的定位：

- system prompt：高稳定度、长期有效
- user message：当前任务相关、可以按轮变化

skill 进入 user message，不只是为了 prompt cache；它也在语义上说明了：

> 这是一份当前任务上下文中的附加指导，不是 agent 身份本体的一部分。

这层语义很重要。

因为一旦你把 skill 并进 system prompt，架构上就会开始误导自己：仿佛这些任务说明也属于 agent 的永久人格设定。

---

## 6. 一个很好用的判断法：这条规则是否应该“几乎总是存在”

你可以用这个问题判断某条内容更适合放哪：

### 如果答案是“几乎总是存在”

例如：

- 遵守安全规则
- 与用户协作时保持透明
- 使用工具前先阅读上下文

那更像 system prompt。

### 如果答案是“只在某类任务里特别有价值”

例如：

- 做浏览器自动化时遵循 ref 生命周期
- 处理 docx 时先 unpack 再 edit 再 pack
- 做代码审查时按固定 checklist 走

那更像 skill。

---

## 7. 为什么 skill 边界看清后，prompt 结构也会更稳定

只要你一开始就把 skill 当成“任务专用操作指南”，很多设计决定都会自然变清楚：

- 它不必永久驻留在 system prompt 前缀里
- 它适合按 trigger 激活
- 它适合随着任务切换而替换
- 它和 memory 不会争抢同一个存储位

换句话说，skill 的边界一旦清楚，prompt assembly、cache 策略、memory system 的分工都会一起变顺。

---

## 8. 和主线章节怎么连起来

这页 bridge doc 最适合这样串读：

- `h04`：知道 prompt 是分 section 组装的
- `h04a`：理解稳定前缀为什么重要
- `h08`：理解 skill 为什么以 user message 注入
- 这页：进一步看清 skill 和 system prompt / memory / plugin 的边界

这样你对 skill 的理解就不再只是“一个 markdown 文件”，而会升级成“一个有明确注入层级的行为指导模块”。

---

## 9. 这页最该带走的一句话

Skill 不是 system prompt 的补丁包，也不是长期 memory 的另一种写法。

它是面向当前任务族的一份可切换操作指南——正因为如此，它才应该被当作一层独立的注入边界来设计。
