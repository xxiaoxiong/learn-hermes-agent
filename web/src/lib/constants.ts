export type Version =
  | "h01" | "h02" | "h03" | "h04" | "h05" | "h06"
  | "h07" | "h08" | "h09" | "h10" | "h11"
  | "h12" | "h13" | "h14" | "h15"
  | "h16" | "h17" | "h18" | "h19";

export type Layer = "core" | "hardening" | "runtime" | "platform";

export type I18nStr = { zh: string; en: string };

export function pick(s: I18nStr, locale: string): string {
  return locale === "zh" ? s.zh : s.en;
}

export const VERSION_ORDER: Version[] = [
  "h01", "h02", "h03", "h04", "h05", "h06",
  "h07", "h08", "h09", "h10", "h11",
  "h12", "h13", "h14", "h15",
  "h16", "h17", "h18", "h19",
];

export interface VersionMeta {
  title: I18nStr;
  subtitle: I18nStr;
  coreAddition: I18nStr;
  keyInsight: I18nStr;
  layer: Layer;
  /** h01-h06: agents/hXX_*.py (full teaching impl)
   *  h07-h19: snippets/hXX_*.py (curated real source) */
  sourceType: "teaching" | "snippet";
  /** Corresponding Hermes source file(s) */
  hermesSource: string[];
}

export const VERSION_META: Record<Version, VersionMeta> = {
  h01: {
    title: { zh: "Agent 循环", en: "Agent Loop" },
    subtitle: { zh: "while 循环驱动的持续执行引擎", en: "A continuous execution engine driven by a while loop" },
    coreAddition: { zh: "while 循环 + tool_result 消息回流", en: "while loop + tool_result message feedback" },
    keyInsight: { zh: 'agent 不是"一问一答"——它是一个持续运行的循环，直到模型主动选择停止调用工具', en: "An agent is not one-question-one-answer — it's a continuous loop that runs until the model actively stops calling tools" },
    layer: "core",
    sourceType: "teaching",
    hermesSource: ["run_agent.py"],
  },
  h02: {
    title: { zh: "工具系统", en: "Tool System" },
    subtitle: { zh: "注册表解耦 schema 与 handler", en: "Registry decouples schema from handler" },
    coreAddition: { zh: "ToolRegistry — schema 与 handler 分离注册", en: "ToolRegistry — separate registration of schema and handler" },
    keyInsight: { zh: 'tool schema 是给模型的说明书，handler 是给代码的执行器——两者分离才能"不改主循环添新工具"', en: "Tool schema is the manual for the model, handler is the executor for the code — separating them means adding new tools without changing the main loop" },
    layer: "core",
    sourceType: "teaching",
    hermesSource: ["tools/registry.py"],
  },
  h03: {
    title: { zh: "规划与待办", en: "Planning & Todos" },
    subtitle: { zh: "agent-level tool 拦截 + 任务状态追踪", en: "Agent-level tool interception + task state tracking" },
    coreAddition: { zh: "agent-level tool 拦截 + PlanState 任务列表", en: "Agent-level tool interception + PlanState task list" },
    keyInsight: { zh: 'todo 不是普通工具——它修改的是 agent 自身执行状态，在 ToolRegistry dispatch 之前被主循环拦截', en: "Todo is not an ordinary tool — it modifies the agent's own execution state, intercepted by the main loop before ToolRegistry dispatch" },
    layer: "core",
    sourceType: "teaching",
    hermesSource: ["run_agent.py", "tools/todo_tool.py"],
  },
  h04: {
    title: { zh: "Prompt 组装", en: "Prompt Assembly" },
    subtitle: { zh: "5 层 section 按优先级动态组装 system prompt", en: "5-layer sections assembled dynamically by priority into system prompt" },
    coreAddition: { zh: "PromptBuilder — 5 类 section 按优先级组装", en: "PromptBuilder — 5 section types assembled by priority" },
    keyInsight: { zh: 'system prompt 不是一次性写死的字符串——它是运行时根据文件和状态动态构建的', en: "The system prompt is not a hardcoded string — it's dynamically constructed at runtime based on files and state" },
    layer: "core",
    sourceType: "teaching",
    hermesSource: ["agent/prompt_builder.py"],
  },
  h05: {
    title: { zh: "上下文压缩", en: "Context Compression" },
    subtitle: { zh: "preflight 阈值触发 + middle turns 摘要 + lineage 谱系", en: "Preflight threshold trigger + middle turns summary + lineage tracking" },
    coreAddition: { zh: "ContextCompressor — preflight 检查 + middle turns 摘要", en: "ContextCompressor — preflight check + middle turns summarization" },
    keyInsight: { zh: '压缩不是删除历史——"中间摘要 + 保留最新 N 条"才是正确姿势；lineage_id 保证谱系可追溯', en: "Compression isn't deleting history — 'middle summary + keep latest N turns' is the right approach; lineage_id ensures traceable genealogy" },
    layer: "core",
    sourceType: "teaching",
    hermesSource: ["run_agent.py", "agent/compression.py"],
  },
  h06: {
    title: { zh: "会话存储", en: "Session Storage" },
    subtitle: { zh: "SQLite + FTS5 全文索引持久化会话历史", en: "SQLite + FTS5 full-text indexed persistent session history" },
    coreAddition: { zh: "SessionDB — SQLite + FTS5 全文搜索 + 多平台隔离", en: "SessionDB — SQLite + FTS5 full-text search + multi-platform isolation" },
    keyInsight: { zh: 'SQLite 不只是存储——FTS5 全文搜索让 agent 能"记起"过去的对话；parent_session_id 保证压缩谱系可追溯', en: "SQLite is not just storage — FTS5 full-text search lets the agent recall past conversations; parent_session_id ensures compression genealogy is traceable" },
    layer: "core",
    sourceType: "teaching",
    hermesSource: ["hermes_state.py", "tools/session_search_tool.py"],
  },
  h07: {
    title: { zh: "记忆系统", en: "Memory System" },
    subtitle: { zh: "跨会话持久记忆 — flush 时机与去重策略", en: "Cross-session persistent memory — flush timing and dedup strategy" },
    coreAddition: { zh: "memory flush — turn 结束前强制写入 + 去重逻辑", en: "Memory flush — force write before turn ends + dedup logic" },
    keyInsight: { zh: '上下文里的知识 ≠ 记忆——没写入 MEMORY.md 就等于没记住', en: "Knowledge in context ≠ memory — if it's not written to MEMORY.md, it's not remembered" },
    layer: "hardening",
    sourceType: "snippet",
    hermesSource: ["agent/memory_manager.py", "tools/memory_tool.py"],
  },
  h08: {
    title: { zh: "技能系统", en: "Skills System" },
    subtitle: { zh: "skill 注入为 user message，维护 prompt cache", en: "Skill injected as user message, maintaining prompt cache" },
    coreAddition: { zh: "skill 注入策略 — user message 注入（非 system prompt）", en: "Skill injection strategy — user message injection (not system prompt)" },
    keyInsight: { zh: 'skill 是操作指南，不是人格设定——注入为 user message 是为了不破坏 system prompt 的 cache 命中', en: "A skill is an operating guide, not a persona — injecting as user message avoids breaking system prompt cache hit" },
    layer: "hardening",
    sourceType: "snippet",
    hermesSource: ["agent/skill_commands.py"],
  },
  h09: {
    title: { zh: "权限审批", en: "Approval & Permission" },
    subtitle: { zh: "DangerPattern 拦截 + allowlist 优先 pipeline", en: "DangerPattern interception + allowlist-first pipeline" },
    coreAddition: { zh: "DangerPattern 危险检测 — deny → check → allow → ask 四段 pipeline", en: "DangerPattern danger detection — deny → check → allow → ask 4-stage pipeline" },
    keyInsight: { zh: '安全门不在工具内部——拦截点在工具调度层统一判断，保证所有工具都经过同一套权限逻辑', en: "The security gate is not inside the tool — interception is unified at the tool dispatch layer, ensuring all tools go through the same permission logic" },
    layer: "hardening",
    sourceType: "snippet",
    hermesSource: ["tools/approval.py"],
  },
  h10: {
    title: { zh: "错误恢复", en: "Error Recovery" },
    subtitle: { zh: "fallback_providers 链 — 失败不等于任务失败", en: "fallback_providers chain — failure doesn't mean task failure" },
    coreAddition: { zh: "fallback_providers 链 — 429/5xx/401 分策略 + continuation reason", en: "fallback_providers chain — 429/5xx/401 per-strategy + continuation reason" },
    keyInsight: { zh: '大多数失败不是任务失败——retry 和 fallback 是不同层级的响应；失败后重入循环继续才是正确姿势', en: "Most failures aren't task failures — retry and fallback are different levels of response; re-entering the loop after failure is the right approach" },
    layer: "hardening",
    sourceType: "snippet",
    hermesSource: ["run_agent.py"],
  },
  h11: {
    title: { zh: "CLI 架构", en: "CLI Architecture" },
    subtitle: { zh: "COMMAND_REGISTRY 驱动多端 slash command 派生", en: "COMMAND_REGISTRY drives multi-platform slash command derivation" },
    coreAddition: { zh: "COMMAND_REGISTRY — CommandDef 从中心注册表辐射 CLI/Gateway/Telegram", en: "COMMAND_REGISTRY — CommandDef radiates from central registry to CLI/Gateway/Telegram" },
    keyInsight: { zh: 'slash command 不是函数调用——它是带路由规则的命令描述符，同一份 registry 驱动所有端', en: "A slash command is not a function call — it's a command descriptor with routing rules, one registry drives all platforms" },
    layer: "hardening",
    sourceType: "snippet",
    hermesSource: ["hermes_cli/commands.py", "cli.py"],
  },
  h12: {
    title: { zh: "网关系统", en: "Gateway System" },
    subtitle: { zh: "GatewayRunner + platform adapter 统一接入 15 个平台", en: "GatewayRunner + platform adapter unified access for 15 platforms" },
    coreAddition: { zh: "GatewayRunner — on_message → MessageEvent 统一格式 + session routing", en: "GatewayRunner — on_message → MessageEvent unified format + session routing" },
    keyInsight: { zh: '平台适配层 ≠ agent 逻辑——adapter 只负责格式转换，AIAgent 对平台完全无感', en: "Platform adapter layer ≠ agent logic — adapter only handles format conversion, AIAgent is completely platform-agnostic" },
    layer: "runtime",
    sourceType: "snippet",
    hermesSource: ["gateway/run.py", "gateway/platforms/"],
  },
  h13: {
    title: { zh: "定时调度", en: "Cron Scheduler" },
    subtitle: { zh: "jobs.json + skill attachment + 定时自主执行", en: "jobs.json + skill attachment + autonomous scheduled execution" },
    coreAddition: { zh: "cron job — scheduler tick → fresh AIAgent → 执行 → platform delivery", en: "cron job — scheduler tick → fresh AIAgent → execute → platform delivery" },
    keyInsight: { zh: 'cron job 不是 shell 脚本——它是一个带完整 agent 能力的定时任务，可绑定 skill 作为上下文', en: "A cron job is not a shell script — it's a scheduled task with full agent capability, bindable to a skill as context" },
    layer: "runtime",
    sourceType: "snippet",
    hermesSource: ["cron/jobs.py", "cron/scheduler.py"],
  },
  h14: {
    title: { zh: "Hook 系统", en: "Hook System" },
    subtitle: { zh: "pre/post_tool_call 生命周期 — 不改主循环扩展行为", en: "pre/post_tool_call lifecycle — extend behavior without changing main loop" },
    coreAddition: { zh: "HookEvent 生命周期 — pre/post_tool_call + builtin_hooks", en: "HookEvent lifecycle — pre/post_tool_call + builtin_hooks" },
    keyInsight: { zh: 'hook 只能观察和注解，不能替代主循环的控制流——这是 plugin 可扩展性的边界', en: "Hooks can only observe and annotate, not replace the main loop's control flow — this is the boundary of plugin extensibility" },
    layer: "runtime",
    sourceType: "snippet",
    hermesSource: ["gateway/hooks.py", "hermes_cli/plugins.py"],
  },
  h15: {
    title: { zh: "子代理委托", en: "Subagent Delegation" },
    subtitle: { zh: "IterationBudget 跨父子 agent 共享 + 上下文隔离", en: "IterationBudget shared across parent-child agents + context isolation" },
    coreAddition: { zh: "delegate_tool — 子 agent spawn + IterationBudget 共享 + ThreadPoolExecutor 并发", en: "delegate_tool — child agent spawn + IterationBudget sharing + ThreadPoolExecutor concurrency" },
    keyInsight: { zh: '子 agent 的关键是干净的上下文，不是独立的 API 调用——context isolation 才是 delegation 的核心', en: "The key to a subagent is clean context, not independent API calls — context isolation is the core of delegation" },
    layer: "runtime",
    sourceType: "snippet",
    hermesSource: ["tools/delegate_tool.py"],
  },
  h16: {
    title: { zh: "Provider 运行时", en: "Provider Runtime" },
    subtitle: { zh: "(provider, model) → api_mode 映射 + CredentialPool 轮换", en: "(provider, model) → api_mode mapping + CredentialPool rotation" },
    coreAddition: { zh: "provider resolution — explicit → provider → base_url → default 优先级链", en: "Provider resolution — explicit → provider → base_url → default priority chain" },
    keyInsight: { zh: 'provider 抽象层不是 if-else——它是 (provider, model) → (api_mode, key, url) 的映射，支持 18+ provider', en: "The provider abstraction layer is not if-else — it's a (provider, model) → (api_mode, key, url) mapping supporting 18+ providers" },
    layer: "platform",
    sourceType: "snippet",
    hermesSource: ["hermes_cli/runtime_provider.py", "hermes_cli/auth.py"],
  },
  h17: {
    title: { zh: "MCP 集成", en: "MCP Integration" },
    subtitle: { zh: "动态工具发现 + 原生工具共用同一 ToolRegistry", en: "Dynamic tool discovery + native tools sharing the same ToolRegistry" },
    coreAddition: { zh: "MCP tool discovery — JSON-RPC 握手 → list_tools → 注册到 registry", en: "MCP tool discovery — JSON-RPC handshake → list_tools → register to registry" },
    keyInsight: { zh: 'MCP 工具不是"外挂"——它进入同一个注册表，走同一条 dispatch 路径', en: "MCP tools are not add-ons — they enter the same registry and follow the same dispatch path" },
    layer: "platform",
    sourceType: "snippet",
    hermesSource: ["tools/mcp_tool.py"],
  },
  h18: {
    title: { zh: "插件系统", en: "Plugin System" },
    subtitle: { zh: "PluginContext API — 不 fork 代码扩展 Hermes", en: "PluginContext API — extend Hermes without forking" },
    coreAddition: { zh: "PluginContext — register_tool / register_hook / register_command + 3 种发现源", en: "PluginContext — register_tool / register_hook / register_command + 3 discovery sources" },
    keyInsight: { zh: "plugin 不是 skill——plugin 注册工具和钩子，skill 注入操作指南；两者边界清晰", en: "A plugin is not a skill — plugins register tools and hooks, skills inject operating guides; the boundary is clear" },
    layer: "platform",
    sourceType: "snippet",
    hermesSource: ["hermes_cli/plugins.py", "plugins/memory/"],
  },
  h19: {
    title: { zh: "RL 与轨迹", en: "RL & Trajectories" },
    subtitle: { zh: "ShareGPT 轨迹生成 + 过滤 + Atropos RL 接入", en: "ShareGPT trajectory generation + filtering + Atropos RL integration" },
    coreAddition: { zh: "batch_runner — 并行轨迹生成 + trajectory_compressor 数据清洗", en: "batch_runner — parallel trajectory generation + trajectory_compressor data cleaning" },
    keyInsight: { zh: "不是所有轨迹都值得训练——过滤和格式化才是数据生成流水线的核心", en: "Not all trajectories are worth training — filtering and formatting are the core of the data generation pipeline" },
    layer: "platform",
    sourceType: "snippet",
    hermesSource: ["batch_runner.py", "agent/trajectory.py"],
  },
};

export const LAYERS: Record<Layer, { label: string; labelZh: string; versions: Version[]; color: string }> = {
  core: {
    label: "Core Single-Agent",
    labelZh: "核心单 Agent",
    versions: ["h01", "h02", "h03", "h04", "h05", "h06"],
    color: "blue",
  },
  hardening: {
    label: "Production Hardening",
    labelZh: "生产加固",
    versions: ["h07", "h08", "h09", "h10", "h11"],
    color: "amber",
  },
  runtime: {
    label: "Multi-Platform Runtime",
    labelZh: "多平台运行时",
    versions: ["h12", "h13", "h14", "h15"],
    color: "emerald",
  },
  platform: {
    label: "Advanced Platform",
    labelZh: "高级平台能力",
    versions: ["h16", "h17", "h18", "h19"],
    color: "purple",
  },
};

export const LAYER_ORDER: Layer[] = ["core", "hardening", "runtime", "platform"];

export const LEARNING_PATH = VERSION_ORDER.map((v) => ({
  version: v,
  ...VERSION_META[v],
}));
