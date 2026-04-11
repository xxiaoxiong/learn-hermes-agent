import type { Version } from "./constants";
import type { I18nStr } from "./constants";

export interface ChapterGuide {
  focus: I18nStr;
  confusion: I18nStr;
  goal: I18nStr;
}

export const CHAPTER_GUIDES: Record<Version, ChapterGuide> = {
  h01: {
    focus: { zh: "`messages` 列表和 `tool_result` 如何形成闭环", en: "How the `messages` list and `tool_result` form a closed loop" },
    confusion: { zh: '别把"模型在思考"和"agent 在行动"混为一谈，行动靠的是循环', en: "Don't conflate 'model is thinking' with 'agent is acting' — action depends on the loop" },
    goal: { zh: "手写一个最小但真实可运行的 Hermes 风格 agent 循环", en: "Hand-write a minimal but genuinely runnable Hermes-style agent loop" },
  },
  h02: {
    focus: { zh: "`ToolRegistry`、dispatch map、tool_result 的对应关系", en: "The relationship between `ToolRegistry`, dispatch map, and tool_result" },
    confusion: { zh: "tool schema 是给模型的说明书，handler 是给代码的执行器，两者分离", en: "Tool schema is the manual for the model, handler is the executor for the code — they're separated" },
    goal: { zh: "在不改主循环的前提下添加一个新工具", en: "Add a new tool without changing the main loop" },
  },
  h03: {
    focus: { zh: "todo 工具在注册表**之前**被拦截的位置", en: "Where the todo tool is intercepted **before** the registry" },
    confusion: { zh: "todo 不是普通工具——它修改的是 agent 状态，不经过 registry", en: "Todo is not an ordinary tool — it modifies agent state, bypassing the registry" },
    goal: { zh: "让 agent 把一个大目标拆成可追踪的小步骤", en: "Have the agent break a big goal into trackable small steps" },
  },
  h04: {
    focus: { zh: "`PromptBuilder` 如何按优先级组装 5 类 section", en: "How `PromptBuilder` assembles 5 section types by priority" },
    confusion: { zh: "system prompt 不是一次性写死的字符串，它是运行时动态构建的", en: "The system prompt is not a hardcoded string — it's dynamically constructed at runtime" },
    goal: { zh: "修改一个 section 而不影响其他 section 的输出", en: "Modify one section without affecting the output of other sections" },
  },
  h05: {
    focus: { zh: "`protect_last_n` 和 `lineage_id` 这两个参数", en: "The two parameters `protect_last_n` and `lineage_id`" },
    confusion: { zh: '压缩不是删除历史——中间摘要 + 保留最新 N 条才是正确姿势', en: "Compression isn't deleting history — middle summary + keep latest N turns is the right approach" },
    goal: { zh: "触发一次压缩，并验证新 session 能追溯到原 session", en: "Trigger a compression and verify the new session can trace back to the original" },
  },
  h06: {
    focus: { zh: "`session_id`、`parent_session_id` 和 FTS5 索引的关系", en: "The relationship between `session_id`, `parent_session_id`, and FTS5 index" },
    confusion: { zh: "SQLite 不只是存储——FTS5 全文搜索让 agent 能记起过去的对话", en: "SQLite is not just storage — FTS5 full-text search lets the agent recall past conversations" },
    goal: { zh: "保存一个 session 并用关键词检索到它", en: "Save a session and retrieve it by keyword search" },
  },
  h07: {
    focus: { zh: "`memory flush` 在 turn 结束前执行的时机", en: "The timing of `memory flush` executing before the turn ends" },
    confusion: { zh: "上下文里的知识 ≠ 记忆——没写入 MEMORY.md 就等于没记住", en: "Knowledge in context ≠ memory — if not written to MEMORY.md, it's not remembered" },
    goal: { zh: "验证 agent 重启后仍能用到上次写入的 memory", en: "Verify the agent can still use previously written memory after restarting" },
  },
  h08: {
    focus: { zh: "skill 注入用 `user message` 而非 `system prompt` 的原因", en: "Why skill injection uses `user message` instead of `system prompt`" },
    confusion: { zh: "skill 是操作指南，不是人格设定——别和 SOUL.md 混用", en: "A skill is an operating guide, not a persona — don't mix it with SOUL.md" },
    goal: { zh: "写一个 skill 文件并让 agent 在对话中自动调用它", en: "Write a skill file and have the agent automatically invoke it in conversation" },
  },
  h09: {
    focus: { zh: "`DangerPattern` 正则和 `allowlist` 的匹配顺序", en: "The matching order of `DangerPattern` regex and `allowlist`" },
    confusion: { zh: "安全门不在工具内部——拦截点在工具调度层统一判断", en: "The security gate is not inside the tool — interception is unified at the tool dispatch layer" },
    goal: { zh: "添加一条自定义危险规则并验证它被正确拦截", en: "Add a custom danger rule and verify it's correctly intercepted" },
  },
  h10: {
    focus: { zh: "`fallback_providers` 列表的触发条件（429 / 5xx / 401）", en: "The trigger conditions for the `fallback_providers` list (429 / 5xx / 401)" },
    confusion: { zh: "大多数失败不是任务失败——retry 和 fallback 是不同层级的响应", en: "Most failures aren't task failures — retry and fallback are different levels of response" },
    goal: { zh: "配置一个 fallback provider 并模拟主模型 429 触发切换", en: "Configure a fallback provider and simulate a main model 429 to trigger switching" },
  },
  h11: {
    focus: { zh: "`COMMAND_REGISTRY` 里一个 `CommandDef` 的完整字段", en: "The complete fields of a `CommandDef` in `COMMAND_REGISTRY`" },
    confusion: { zh: "slash command 不是函数调用——它是带路由规则的命令描述符", en: "A slash command is not a function call — it's a command descriptor with routing rules" },
    goal: { zh: "注册一个新 slash command 并让它在 CLI 和 Gateway 中同时生效", en: "Register a new slash command and make it work in both CLI and Gateway" },
  },
  h12: {
    focus: { zh: "`GatewayRunner._handle_message()` 里的 session routing 逻辑", en: "The session routing logic in `GatewayRunner._handle_message()`" },
    confusion: { zh: "平台适配层 ≠ agent 逻辑——adapter 只负责格式转换，agent 对平台无感", en: "Platform adapter layer ≠ agent logic — adapter only handles format conversion, agent is platform-agnostic" },
    goal: { zh: "理解为什么同一个 AIAgent 能同时服务 Telegram 和 Discord", en: "Understand why the same AIAgent can serve Telegram and Discord simultaneously" },
  },
  h13: {
    focus: { zh: "`jobs.json` 里 `skill_attachment` 字段的作用", en: "The purpose of the `skill_attachment` field in `jobs.json`" },
    confusion: { zh: "cron job 不是 shell 脚本——它是一个带完整 agent 能力的定时任务", en: "A cron job is not a shell script — it's a scheduled task with full agent capability" },
    goal: { zh: "创建一个每天运行、结果发到指定平台的 cron job", en: "Create a daily cron job that delivers results to a specified platform" },
  },
  h14: {
    focus: { zh: "`pre_tool_call` 和 `post_tool_call` hook 的触发位置", en: "The trigger points of `pre_tool_call` and `post_tool_call` hooks" },
    confusion: { zh: "hook 只能观察和注解，不能替代主循环的控制流", en: "Hooks can only observe and annotate, not replace the main loop's control flow" },
    goal: { zh: "写一个 hook 在每次工具调用后打印日志，而不修改主循环", en: "Write a hook that logs after every tool call without modifying the main loop" },
  },
  h15: {
    focus: { zh: "`IterationBudget` 如何跨父子 agent 共享", en: "How `IterationBudget` is shared across parent-child agents" },
    confusion: { zh: "子 agent 的关键是干净的上下文，不是独立的 API 调用", en: "The key to a subagent is clean context, not independent API calls" },
    goal: { zh: "用 delegate_tool 把一个子任务委派给子 agent 并拿回摘要", en: "Use delegate_tool to delegate a subtask to a child agent and get back a summary" },
  },
  h16: {
    focus: { zh: "API mode 的解析优先级（explicit → provider → base_url → default）", en: "The resolution priority of API mode (explicit → provider → base_url → default)" },
    confusion: { zh: "provider 抽象层不是 if-else——它是 (provider, model) → (api_mode, key, url) 的映射", en: "The provider abstraction layer is not if-else — it's a (provider, model) → (api_mode, key, url) mapping" },
    goal: { zh: "添加一个新 provider 配置并让它正确解析到对应 API mode", en: "Add a new provider configuration and verify it correctly resolves to the corresponding API mode" },
  },
  h17: {
    focus: { zh: "MCP tool 在 `tools/registry.py` 里如何与原生工具共存", en: "How MCP tools coexist with native tools in `tools/registry.py`" },
    confusion: { zh: "MCP 工具不是外挂——它进入同一个注册表，走同一条 dispatch 路径", en: "MCP tools are not add-ons — they enter the same registry and follow the same dispatch path" },
    goal: { zh: "连接一个 MCP server 并验证其工具在 agent 中可直接调用", en: "Connect an MCP server and verify its tools can be directly called in the agent" },
  },
  h18: {
    focus: { zh: "`PluginContext.register_tool()` 和原生 `registry.register()` 的区别", en: "The difference between `PluginContext.register_tool()` and native `registry.register()`" },
    confusion: { zh: "plugin 不是 skill——plugin 注册工具和钩子，skill 注入操作指南", en: "A plugin is not a skill — plugins register tools and hooks, skills inject operating guides" },
    goal: { zh: "写一个最小插件，注册一个工具，不修改任何 Hermes 核心文件", en: "Write a minimal plugin that registers a tool without modifying any Hermes core files" },
  },
  h19: {
    focus: { zh: "`trajectory_compressor.py` 的过滤规则", en: "The filtering rules in `trajectory_compressor.py`" },
    confusion: { zh: "不是所有轨迹都值得训练——过滤和格式化才是数据生成的核心", en: "Not all trajectories are worth training — filtering and formatting are the core of data generation" },
    goal: { zh: "用 batch_runner 生成 10 条轨迹并输出为 ShareGPT 格式", en: "Use batch_runner to generate 10 trajectories and output in ShareGPT format" },
  },
};
