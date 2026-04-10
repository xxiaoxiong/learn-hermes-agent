# h10a — Fallback Taxonomy：为什么 retry、fallback、continuation 不是同一种补救动作

> 这页是 `h10` 的延伸。主线章节已经讲了错误分类和 `fallback_providers`；这份 bridge doc 要再往前走一步：**当一次调用失败时，系统真正需要区分的不是“要不要重试”，而是“失败属于哪一层，以及下一步该在哪一层补救”。**

---

## 先说结论

很多系统把错误恢复压成一句话：

> 出错了就重试，不行就换模型。

这句话太粗了。

Hermes 更准确的思路是把补救动作拆成至少三层：

- **retry**：同一路径，再试一次
- **fallback**：换一条路径继续
- **continuation**：把失败结果带回循环，让 agent 重新决策

这三者不是并列的“同义词”，而是三个不同层级的恢复动作。

---

## 1. retry 解决的是“这条路也许只是暂时不通”

Retry 的假设是：

- 这次失败是暂时性的
- 原来的 provider / model 仍然可能成功
- 没必要马上改策略

典型场景包括：

- 429 限流但可能几秒后恢复
- 5xx 上游暂时抖动
- 408 / 504 超时但网络稍后可能好转

所以 retry 的本质是：

**先不改路线，只给原路线一次恢复机会。**

---

## 2. fallback 解决的是“继续在这条路上耗下去没意义了”

Fallback 的假设和 retry 不同：

- 当前 provider 可能持续不可用
- 当前模型能力或配额不适合继续承担这次任务
- 换条路比继续等更合理

典型场景包括：

- 主 provider 一直 rate limit
- API key 失效（401）
- 某个辅助模型不支持当前模态能力

所以 fallback 的本质是：

**承认原路线不值得继续，坚持任务目标，但切换实现路径。**

---

## 3. continuation 解决的是“系统不能因为一次失败就退出主循环”

Retry 和 fallback 还都停留在“模型调用层”。

但 Hermes 还有第三层思路：

- 即便这次调用最终还是失败了
- 也不应该立刻把整个任务判死
- 错误本身可以作为一种结果，回流给 agent

这就是 continuation 的作用。

它不是重试，也不是切 provider，而是：

- 把失败包装成当前回合的一部分
- 让 agent 在下一轮重新判断怎么办

所以 continuation 属于**控制流恢复**，而不是底层 API 恢复。

---

## 4. 为什么把这三者混成一类会出问题

如果你把 retry、fallback、continuation 统统理解成“失败处理”，通常会出现两类坏结果：

### 坏结果 1：该换路时还在死命重试

例如 401 或持续不可用的 provider，本该 fallback，却还在原地 retry。

### 坏结果 2：底层恢复失败后直接退出整个任务

明明模型还可以根据错误信息改走别的计划，但系统已经先把主循环停掉了。

这两个问题的根源，都是没有先区分失败的层级。

---

## 5. 一个很好用的判断框架：先问“失败发生在哪一层”

### 层 1：传输 / 瞬时可用性层失败

例如超时、短暂限流、短暂 5xx。  
更适合先 retry。

### 层 2：当前 provider 路径失败

例如认证失效、持续限流、能力不匹配。  
更适合 fallback。

### 层 3：单次调用失败，但任务本身未必失败

例如辅助步骤失败、某种方案不可行、工具结果异常。  
更适合 continuation，让 agent 重新决策。

只要先把失败定位到这一层，后面的补救动作就不容易乱。

---

## 6. 为什么 auxiliary 任务更能体现这个 taxonomy

Hermes 里不只是主对话会失败，辅助任务也会失败，例如：

- compression
- vision
- session search

这些任务很适合体现恢复分层：

- compression 小模型超时 → retry
- compression 当前 provider 不可用 → fallback 到便宜备用模型
- compression 最终仍失败 → continuation，让主循环用保守策略继续

这正说明：

**错误恢复不是一个 if-else，而是一套按层级分解的 runtime 策略。**

---

## 7. 为什么 continuation 是最容易被忽视、却最像 agent 思维的一层

传统请求型程序出错时常见做法是：

- 返回错误
- 终止执行

但 agent system 不一样。

对 agent 来说，失败本身也是环境反馈的一部分。只要任务目标还没彻底失效，系统就应该允许模型基于失败重新判断下一步。

这就是 continuation 最有价值的地方：

- 它不假装失败不存在
- 它也不把失败直接升级成任务终止
- 它把失败重新纳入 loop

这其实非常符合 agent 的本质：

> 观察环境 → 调整策略 → 继续推进

---

## 8. 和主线章节怎么连起来

这页 bridge doc 最适合这样串起来：

- `h10`：先掌握错误码分类和 fallback provider 链
- 这页：再把 retry / fallback / continuation 看成三层不同补救动作
- `h16`：之后再看 provider runtime，就会更容易理解为什么 provider 抽象层对错误恢复如此关键

因为没有 provider runtime，fallback 只能写成杂乱分支；有了 provider runtime，fallback 才能成为系统化能力。

---

## 9. 这页最该带走的一句话

失败恢复不是一个动作，而是三层动作：

- 原路再试一次（retry）
- 换条路继续（fallback）
- 把失败带回循环重新决策（continuation）

Hermes 的稳定性，恰恰来自它没有把这三件事混成一个模糊的“出错处理”。
