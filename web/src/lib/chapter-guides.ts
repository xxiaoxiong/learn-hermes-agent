import type { Version } from "./constants";

export interface ChapterGuide {
  focus: string;
  confusion: string;
  goal: string;
}

export const CHAPTER_GUIDES: Record<Version, ChapterGuide> = {
  h01: {
    focus: "`messages` 列表和 `tool_result` 如何形成闭环",
    confusion: '别把"模型在思考"和"agent 在行动"混为一谈，行动靠的是循环',
    goal: "手写一个最小但真实可运行的 Hermes 风格 agent 循环",
  },
  h02: {
    focus: "`ToolRegistry`、dispatch map、tool_result 的对应关系",
    confusion: "tool schema 是给模型的说明书，handler 是给代码的执行器，两者分离",
    goal: "在不改主循环的前提下添加一个新工具",
  },
  h03: {
    focus: "todo 工具在注册表**之前**被拦截的位置",
    confusion: "todo 不是普通工具——它修改的是 agent 状态，不经过 registry",
    goal: "让 agent 把一个大目标拆成可追踪的小步骤",
  },
  h04: {
    focus: "`PromptBuilder` 如何按优先级组装 5 类 section",
    confusion: "system prompt 不是一次性写死的字符串，它是运行时动态构建的",
    goal: "修改一个 section 而不影响其他 section 的输出",
  },
  h05: {
    focus: "`protect_last_n` 和 `lineage_id` 这两个参数",
    confusion: '压缩不是删除历史——中间摘要 + 保留最新 N 条才是正确姿势',
    goal: "触发一次压缩，并验证新 session 能追溯到原 session",
  },
  h06: {
    focus: "`session_id`、`parent_session_id` 和 FTS5 索引的关系",
    confusion: "SQLite 不只是存储——FTS5 全文搜索让 agent 能记起过去的对话",
    goal: "保存一个 session 并用关键词检索到它",
  },
  h07: {
    focus: "`memory flush` 在 turn 结束前执行的时机",
    confusion: "上下文里的知识 ≠ 记忆——没写入 MEMORY.md 就等于没记住",
    goal: "验证 agent 重启后仍能用到上次写入的 memory",
  },
  h08: {
    focus: "skill 注入用 `user message` 而非 `system prompt` 的原因",
    confusion: "skill 是操作指南，不是人格设定——别和 SOUL.md 混用",
    goal: "写一个 skill 文件并让 agent 在对话中自动调用它",
  },
  h09: {
    focus: "`DangerPattern` 正则和 `allowlist` 的匹配顺序",
    confusion: "安全门不在工具内部——拦截点在工具调度层统一判断",
    goal: "添加一条自定义危险规则并验证它被正确拦截",
  },
  h10: {
    focus: "`fallback_providers` 列表的触发条件（429 / 5xx / 401）",
    confusion: "大多数失败不是任务失败——retry 和 fallback 是不同层级的响应",
    goal: "配置一个 fallback provider 并模拟主模型 429 触发切换",
  },
  h11: {
    focus: "`COMMAND_REGISTRY` 里一个 `CommandDef` 的完整字段",
    confusion: "slash command 不是函数调用——它是带路由规则的命令描述符",
    goal: "注册一个新 slash command 并让它在 CLI 和 Gateway 中同时生效",
  },
  h12: {
    focus: "`GatewayRunner._handle_message()` 里的 session routing 逻辑",
    confusion: "平台适配层 ≠ agent 逻辑——adapter 只负责格式转换，agent 对平台无感",
    goal: "理解为什么同一个 AIAgent 能同时服务 Telegram 和 Discord",
  },
  h13: {
    focus: "`jobs.json` 里 `skill_attachment` 字段的作用",
    confusion: "cron job 不是 shell 脚本——它是一个带完整 agent 能力的定时任务",
    goal: "创建一个每天运行、结果发到指定平台的 cron job",
  },
  h14: {
    focus: "`pre_tool_call` 和 `post_tool_call` hook 的触发位置",
    confusion: "hook 只能观察和注解，不能替代主循环的控制流",
    goal: "写一个 hook 在每次工具调用后打印日志，而不修改主循环",
  },
  h15: {
    focus: "`IterationBudget` 如何跨父子 agent 共享",
    confusion: "子 agent 的关键是干净的上下文，不是独立的 API 调用",
    goal: "用 delegate_tool 把一个子任务委派给子 agent 并拿回摘要",
  },
  h16: {
    focus: "API mode 的解析优先级（explicit → provider → base_url → default）",
    confusion: "provider 抽象层不是 if-else——它是 (provider, model) → (api_mode, key, url) 的映射",
    goal: "添加一个新 provider 配置并让它正确解析到对应 API mode",
  },
  h17: {
    focus: "MCP tool 在 `tools/registry.py` 里如何与原生工具共存",
    confusion: "MCP 工具不是外挂——它进入同一个注册表，走同一条 dispatch 路径",
    goal: "连接一个 MCP server 并验证其工具在 agent 中可直接调用",
  },
  h18: {
    focus: "`PluginContext.register_tool()` 和原生 `registry.register()` 的区别",
    confusion: "plugin 不是 skill——plugin 注册工具和钩子，skill 注入操作指南",
    goal: "写一个最小插件，注册一个工具，不修改任何 Hermes 核心文件",
  },
  h19: {
    focus: "`trajectory_compressor.py` 的过滤规则",
    confusion: "不是所有轨迹都值得训练——过滤和格式化才是数据生成的核心",
    goal: "用 batch_runner 生成 10 条轨迹并输出为 ShareGPT 格式",
  },
};
