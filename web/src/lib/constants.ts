export type Version =
  | "h01" | "h02" | "h03" | "h04" | "h05" | "h06"
  | "h07" | "h08" | "h09" | "h10" | "h11"
  | "h12" | "h13" | "h14" | "h15"
  | "h16" | "h17" | "h18" | "h19";

export type Layer = "core" | "hardening" | "runtime" | "platform";

export const VERSION_ORDER: Version[] = [
  "h01", "h02", "h03", "h04", "h05", "h06",
  "h07", "h08", "h09", "h10", "h11",
  "h12", "h13", "h14", "h15",
  "h16", "h17", "h18", "h19",
];

export interface VersionMeta {
  title: string;
  subtitle: string;
  coreAddition: string;
  keyInsight: string;
  layer: Layer;
  /** h01-h06: agents/hXX_*.py (full teaching impl)
   *  h07-h19: snippets/hXX_*.py (curated real source) */
  sourceType: "teaching" | "snippet";
  /** Corresponding Hermes source file(s) */
  hermesSource: string[];
}

export const VERSION_META: Record<Version, VersionMeta> = {
  h01: {
    title: "Agent Loop",
    subtitle: "while 循环驱动的持续执行引擎",
    coreAddition: "while 循环 + tool_result 消息回流",
    keyInsight: 'agent 不是“一问一答”——它是一个持续运行的循环，直到模型主动选择停止调用工具',
    layer: "core",
    sourceType: "teaching",
    hermesSource: ["run_agent.py"],
  },
  h02: {
    title: "Tool System",
    subtitle: "注册表解耦 schema 与 handler",
    coreAddition: "ToolRegistry — schema 与 handler 分离注册",
    keyInsight: 'tool schema 是给模型的说明书，handler 是给代码的执行器——两者分离才能“不改主循环添新工具”',
    layer: "core",
    sourceType: "teaching",
    hermesSource: ["tools/registry.py"],
  },
  h03: {
    title: "Planning & Todos",
    subtitle: "agent-level tool 拦截 + 任务状态追踪",
    coreAddition: "agent-level tool 拦截 + PlanState 任务列表",
    keyInsight: 'todo 不是普通工具——它修改的是 agent 自身执行状态，在 ToolRegistry dispatch 之前被主循环拦截',
    layer: "core",
    sourceType: "teaching",
    hermesSource: ["run_agent.py", "tools/todo_tool.py"],
  },
  h04: {
    title: "Prompt Assembly",
    subtitle: "5 层 section 按优先级动态组装 system prompt",
    coreAddition: "PromptBuilder — 5 类 section 按优先级组装",
    keyInsight: 'system prompt 不是一次性写死的字符串——它是运行时根据文件和状态动态构建的',
    layer: "core",
    sourceType: "teaching",
    hermesSource: ["agent/prompt_builder.py"],
  },
  h05: {
    title: "Context Compression",
    subtitle: "preflight 阈值触发 + middle turns 摘要 + lineage 谱系",
    coreAddition: "ContextCompressor — preflight 检查 + middle turns 摘要",
    keyInsight: '压缩不是删除历史——“中间摘要 + 保留最新 N 条”才是正确姿势；lineage_id 保证谱系可追溯',
    layer: "core",
    sourceType: "teaching",
    hermesSource: ["run_agent.py", "agent/compression.py"],
  },
  h06: {
    title: "Session Storage",
    subtitle: "SQLite + FTS5 全文索引持久化会话历史",
    coreAddition: "SessionDB — SQLite + FTS5 全文搜索 + 多平台隔离",
    keyInsight: 'SQLite 不只是存储——FTS5 全文搜索让 agent 能“记起”过去的对话；parent_session_id 保证压缩谱系可追溯',
    layer: "core",
    sourceType: "teaching",
    hermesSource: ["hermes_state.py", "tools/session_search_tool.py"],
  },
  h07: {
    title: "Memory System",
    subtitle: "跨会话持久记忆 — flush 时机与去重策略",
    coreAddition: "memory flush — turn 结束前强制写入 + 去重逻辑",
    keyInsight: '上下文里的知识 ≠ 记忆——没写入 MEMORY.md 就等于没记住',
    layer: "hardening",
    sourceType: "snippet",
    hermesSource: ["agent/memory_manager.py", "tools/memory_tool.py"],
  },
  h08: {
    title: "Skills System",
    subtitle: "skill 注入为 user message，维护 prompt cache",
    coreAddition: "skill 注入策略 — user message 注入（非 system prompt）",
    keyInsight: 'skill 是操作指南，不是人格设定——注入为 user message 是为了不破坏 system prompt 的 cache 命中',
    layer: "hardening",
    sourceType: "snippet",
    hermesSource: ["agent/skill_commands.py"],
  },
  h09: {
    title: "Approval & Permission",
    subtitle: "DangerPattern 拦截 + allowlist 优先 pipeline",
    coreAddition: "DangerPattern 危险检测 — deny → check → allow → ask 四段 pipeline",
    keyInsight: '安全门不在工具内部——拦截点在工具调度层统一判断，保证所有工具都经过同一套权限逻辑',
    layer: "hardening",
    sourceType: "snippet",
    hermesSource: ["tools/approval.py"],
  },
  h10: {
    title: "Error Recovery",
    subtitle: "fallback_providers 链 — 失败不等于任务失败",
    coreAddition: "fallback_providers 链 — 429/5xx/401 分策略 + continuation reason",
    keyInsight: '大多数失败不是任务失败——retry 和 fallback 是不同层级的响应；失败后重入循环继续才是正确姿势',
    layer: "hardening",
    sourceType: "snippet",
    hermesSource: ["run_agent.py"],
  },
  h11: {
    title: "CLI Architecture",
    subtitle: "COMMAND_REGISTRY 驱动多端 slash command 派生",
    coreAddition: "COMMAND_REGISTRY — CommandDef 从中心注册表辐射 CLI/Gateway/Telegram",
    keyInsight: 'slash command 不是函数调用——它是带路由规则的命令描述符，同一份 registry 驱动所有端',
    layer: "hardening",
    sourceType: "snippet",
    hermesSource: ["hermes_cli/commands.py", "cli.py"],
  },
  h12: {
    title: "Gateway System",
    subtitle: "GatewayRunner + platform adapter 统一接入 15 个平台",
    coreAddition: "GatewayRunner — on_message → MessageEvent 统一格式 + session routing",
    keyInsight: '平台适配层 ≠ agent 逻辑——adapter 只负责格式转换，AIAgent 对平台完全无感',
    layer: "runtime",
    sourceType: "snippet",
    hermesSource: ["gateway/run.py", "gateway/platforms/"],
  },
  h13: {
    title: "Cron Scheduler",
    subtitle: "jobs.json + skill attachment + 定时自主执行",
    coreAddition: "cron job — scheduler tick → fresh AIAgent → 执行 → platform delivery",
    keyInsight: 'cron job 不是 shell 脚本——它是一个带完整 agent 能力的定时任务，可绑定 skill 作为上下文',
    layer: "runtime",
    sourceType: "snippet",
    hermesSource: ["cron/jobs.py", "cron/scheduler.py"],
  },
  h14: {
    title: "Hook System",
    subtitle: "pre/post_tool_call 生命周期 — 不改主循环扩展行为",
    coreAddition: "HookEvent 生命周期 — pre/post_tool_call + builtin_hooks",
    keyInsight: 'hook 只能观察和注解，不能替代主循环的控制流——这是 plugin 可扩展性的边界',
    layer: "runtime",
    sourceType: "snippet",
    hermesSource: ["gateway/hooks.py", "hermes_cli/plugins.py"],
  },
  h15: {
    title: "Subagent Delegation",
    subtitle: "IterationBudget 跨父子 agent 共享 + 上下文隔离",
    coreAddition: "delegate_tool — 子 agent spawn + IterationBudget 共享 + ThreadPoolExecutor 并发",
    keyInsight: '子 agent 的关键是干净的上下文，不是独立的 API 调用——context isolation 才是 delegation 的核心',
    layer: "runtime",
    sourceType: "snippet",
    hermesSource: ["tools/delegate_tool.py"],
  },
  h16: {
    title: "Provider Runtime",
    subtitle: "(provider, model) → api_mode 映射 + CredentialPool 轮换",
    coreAddition: "provider resolution — explicit → provider → base_url → default 优先级链",
    keyInsight: 'provider 抽象层不是 if-else——它是 (provider, model) → (api_mode, key, url) 的映射，支持 18+ provider',
    layer: "platform",
    sourceType: "snippet",
    hermesSource: ["hermes_cli/runtime_provider.py", "hermes_cli/auth.py"],
  },
  h17: {
    title: "MCP Integration",
    subtitle: "动态工具发现 + 原生工具共用同一 ToolRegistry",
    coreAddition: "MCP tool discovery — JSON-RPC 握手 → list_tools → 注册到 registry",
    keyInsight: 'MCP 工具不是“外挂”——它进入同一个注册表，走同一条 dispatch 路径',
    layer: "platform",
    sourceType: "snippet",
    hermesSource: ["tools/mcp_tool.py"],
  },
  h18: {
    title: "Plugin System",
    subtitle: "PluginContext API — 不 fork 代码扩展 Hermes",
    coreAddition: "PluginContext — register_tool / register_hook / register_command + 3 种发现源",
    keyInsight: "plugin 不是 skill——plugin 注册工具和钩子，skill 注入操作指南；两者边界清晰",
    layer: "platform",
    sourceType: "snippet",
    hermesSource: ["hermes_cli/plugins.py", "plugins/memory/"],
  },
  h19: {
    title: "RL & Trajectories",
    subtitle: "ShareGPT 轨迹生成 + 过滤 + Atropos RL 接入",
    coreAddition: "batch_runner — 并行轨迹生成 + trajectory_compressor 数据清洗",
    keyInsight: "不是所有轨迹都值得训练——过滤和格式化才是数据生成流水线的核心",
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
