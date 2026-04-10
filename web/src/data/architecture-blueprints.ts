import type { Version } from "@/lib/constants";

type T = { zh: string; en: string };
const l = (zh: string, en: string): T => ({ zh, en });

export type SliceId = "mainline" | "control" | "state" | "lanes";

export interface ArchItem {
  name: T;
  detail: T;
  fresh?: boolean;
}

export interface ArchBlueprint {
  summary: T;
  slices: Partial<Record<SliceId, ArchItem[]>>;
  handoff: T[];
}

export const ARCH_BLUEPRINTS: Record<Version, ArchBlueprint> = {
  h01: {
    summary: l(
      "第一章建立最小闭环：用户输入进 messages[]，模型决定是否调工具，结果回写同一循环继续推进。",
      "Chapter 1 establishes the smallest closed loop: user input enters messages[], the model decides whether to call a tool, and the result writes back into the same loop."
    ),
    slices: {
      mainline: [
        { name: l("Agent Loop (while)", "Agent Loop (while)"), detail: l("每轮调用模型 → 处理输出 → 决定是否继续，停止条件由模型掌控。", "Each turn calls the model, handles output, and decides whether to continue — the model owns the stop condition."), fresh: true },
      ],
      state: [
        { name: l("messages[]", "messages[]"), detail: l("用户、助手、工具结果全部累积在这里，是 agent 的唯一记忆。", "User, assistant, and tool results all accumulate here — the agent's only memory."), fresh: true },
        { name: l("tool_result 回流", "tool_result write-back"), detail: l("工具结果作为新消息回到 messages[]，驱动下一轮推理。", "Tool results re-enter messages[] as new messages, driving the next reasoning step."), fresh: true },
      ],
    },
    handoff: [
      l("用户消息追加到 messages[]", "User message appended to messages[]"),
      l("模型产出 text 或 tool_use block", "Model emits text or a tool_use block"),
      l("工具结果作为 tool_result 回写，循环继续", "Tool result written back as tool_result — loop continues"),
    ],
  },

  h02: {
    summary: l(
      "把单一工具调用升级为可扩展的注册表——schema 与 handler 分离，主循环不变，添加工具无需改动主流程。",
      "Upgrades a single tool call into a scalable registry — schema and handler are decoupled so adding tools never touches the main loop."
    ),
    slices: {
      mainline: [
        { name: l("主循环（不变）", "Main Loop (unchanged)"), detail: l("主循环继续只管模型调用与 tool_result 回写。", "The main loop still owns only model calls and write-back.") },
      ],
      control: [
        { name: l("ToolRegistry schema 目录", "ToolRegistry schema catalog"), detail: l("把所有工具的 JSON Schema 描述给模型看，模型按 schema 选工具。", "Exposes all tool JSON Schemas to the model; the model picks by schema."), fresh: true },
        { name: l("Dispatch Map", "Dispatch Map"), detail: l("按工具名将调用路由到对应 handler 函数。", "Routes a tool call to the correct handler function by name."), fresh: true },
      ],
      state: [
        { name: l("tool_input (结构化参数)", "tool_input (structured args)"), detail: l("模型传来的已验证工具参数，dispatch 前可拦截校验。", "Validated tool arguments from the model; can be intercepted before dispatch."), fresh: true },
      ],
    },
    handoff: [
      l("模型从 schema 目录选择工具名", "Model selects a tool name from the schema catalog"),
      l("Dispatch Map 查找对应 handler", "Dispatch Map resolves the handler"),
      l("handler 执行并返回 tool_result", "Handler executes and returns tool_result"),
    ],
  },

  h03: {
    summary: l(
      "在 dispatch 之前插入 agent-level 拦截——todo_tool 修改 PlanState，主循环感知任务进度而不暴露给模型。",
      "Inserts an agent-level intercept before dispatch — todo_tool modifies PlanState, letting the main loop track task progress without exposing it to the model."
    ),
    slices: {
      mainline: [
        { name: l("计划先行执行", "Plan-before-execute"), detail: l("先把大目标拆成可追踪步骤，再逐步执行，避免单轮漂移。", "Break the larger goal into trackable steps before acting — prevents single-turn drift."), fresh: true },
      ],
      control: [
        { name: l("agent-level 拦截", "agent-level intercept"), detail: l("todo_tool 在 ToolRegistry dispatch 之前被主循环捕获，直接修改 PlanState。", "todo_tool is caught by the main loop before ToolRegistry dispatch and modifies PlanState directly."), fresh: true },
        { name: l("提醒回路", "Reminder loop"), detail: l("每轮把当前 todo 列表注入 prompt，防止模型忘记计划。", "Each turn injects the current todo list into the prompt to prevent the model from forgetting the plan."), fresh: true },
      ],
      state: [
        { name: l("PlanState", "PlanState"), detail: l("记录所有步骤与当前活跃步骤。", "Tracks all steps and the currently active step."), fresh: true },
        { name: l("TodoItem", "TodoItem"), detail: l("会话级最小计划单位（pending / in_progress / done）。", "The smallest planning unit in a session (pending / in_progress / done)."), fresh: true },
      ],
    },
    handoff: [
      l("用户给出大目标", "User provides a high-level goal"),
      l("模型调用 todo_tool 拆解步骤，PlanState 更新", "Model calls todo_tool to break it down; PlanState updates"),
      l("每步执行完后 mark done，直到全部完成", "Each step is marked done after execution until all complete"),
    ],
  },

  h04: {
    summary: l(
      "PromptBuilder 把 system prompt 拆成 5 类 section，按优先级动态组装——在 token 预算内塞入最有价值的上下文。",
      "PromptBuilder splits the system prompt into 5 section types and assembles them by priority — packing the most valuable context within the token budget."
    ),
    slices: {
      mainline: [
        { name: l("Prompt Assembly 阶段", "Prompt Assembly phase"), detail: l("每轮模型调用之前，PromptBuilder 重新组装 system prompt。", "Before each model call, PromptBuilder re-assembles the system prompt."), fresh: true },
      ],
      control: [
        { name: l("PromptBuilder (5 层优先级)", "PromptBuilder (5-tier priority)"), detail: l("identity > task > memory > tools > context，按权重裁剪后拼接。", "identity > task > memory > tools > context — weighted trimming then concatenation."), fresh: true },
      ],
      state: [
        { name: l("PromptSection", "PromptSection"), detail: l("每个 section 携带优先级和 token 估算，超预算时低优先级被截断。", "Each section carries a priority and token estimate; low-priority sections are truncated when over budget."), fresh: true },
        { name: l("system prompt (组装结果)", "system prompt (assembled)"), detail: l("最终传给模型的 system 字段内容。", "The final string passed in the system field to the model."), fresh: true },
      ],
    },
    handoff: [
      l("收集各类 PromptSection（identity / task / memory / tools / context）", "Collect all PromptSections (identity / task / memory / tools / context)"),
      l("按优先级排序，超预算的低优先级 section 截断", "Sort by priority; truncate low-priority sections if over budget"),
      l("拼接为 system prompt 传入模型调用", "Concatenate into system prompt and pass to the model call"),
    ],
  },

  h05: {
    summary: l(
      "超 token 阈值时将旧对话总结压缩为摘要注入，保持上下文窗口可用——agent 能无限对话不崩溃。",
      "When the token threshold is exceeded, old conversation is summarized and injected as a compact note — the context window stays usable indefinitely."
    ),
    slices: {
      mainline: [
        { name: l("主循环 + token 检查", "Main loop + token check"), detail: l("每轮调用前检查 messages[] 总 token，超限则触发压缩。", "Before each model call, check total token count in messages[]; trigger compression if over threshold."), fresh: true },
      ],
      control: [
        { name: l("Compression Trigger", "Compression Trigger"), detail: l("基于 token 阈值决定是否压缩，避免触发 API context length 错误。", "Fires based on a token threshold to prevent API context-length errors."), fresh: true },
        { name: l("Summary Injector", "Summary Injector"), detail: l("把摘要注入为 system message 或 user message 前缀。", "Injects the summary as a system message or user message prefix."), fresh: true },
      ],
      state: [
        { name: l("summary (摘要文本)", "summary (text)"), detail: l("压缩后的历史摘要，保留关键决策与工具结果。", "Compressed history summary preserving key decisions and tool results."), fresh: true },
        { name: l("messages[] (截断后)", "messages[] (truncated)"), detail: l("压缩后只保留最近 N 条消息。", "Only the most recent N messages are kept after compression."), fresh: true },
      ],
    },
    handoff: [
      l("检测 messages[] token 数超过阈值", "Detect messages[] token count exceeds threshold"),
      l("将旧消息摘要压缩为单条 summary", "Compress old messages into a single summary"),
      l("摘要注入 prompt，继续主循环", "Inject summary into prompt and continue the main loop"),
    ],
  },

  h06: {
    summary: l(
      "会话 ID + JSON 文件持久化——agent 重启后能从断点恢复，不再每次从零开始。",
      "Session ID + JSON file persistence — the agent can resume from a checkpoint after restart instead of starting from scratch."
    ),
    slices: {
      mainline: [
        { name: l("Session Resume 路径", "Session Resume path"), detail: l("启动时先查找 session_id 对应文件，找到则加载历史，否则新建。", "On startup, look up the session_id file; if found, load history; otherwise create new."), fresh: true },
      ],
      control: [
        { name: l("Session Loader", "Session Loader"), detail: l("读取 session 文件，反序列化 messages[]。", "Reads the session file and deserializes messages[]."), fresh: true },
        { name: l("Session Saver", "Session Saver"), detail: l("每轮结束后将 messages[] 序列化写入文件。", "After each turn, serializes messages[] back to file."), fresh: true },
      ],
      state: [
        { name: l("SessionStore (JSON 文件)", "SessionStore (JSON file)"), detail: l("持久化存储，键为 session_id，值为 messages[]。", "Persistent storage keyed by session_id, value is messages[]."), fresh: true },
        { name: l("session_id", "session_id"), detail: l("对话标识符，来自命令行参数或自动生成。", "Conversation identifier from CLI arg or auto-generated."), fresh: true },
      ],
    },
    handoff: [
      l("启动时按 session_id 查找持久化文件", "On startup, look up persistent file by session_id"),
      l("存在则加载 messages[]，不存在则初始化空历史", "If found, load messages[]; otherwise init empty history"),
      l("对话结束后将 messages[] 写回文件", "After conversation, write messages[] back to file"),
    ],
  },

  h07: {
    summary: l(
      "flush 时把跨会话知识持久化到 MEMORY.md，下次启动加载进 system prompt——memory 不是缓存，是主动写入。",
      "On flush, cross-session knowledge is persisted to MEMORY.md and loaded into the system prompt on the next startup — memory is not a cache, it is an active write."
    ),
    slices: {
      mainline: [
        { name: l("Main Loop", "Main Loop"), detail: l("主循环继续正常运行，memory flush 是异步触发的副作用。", "The main loop continues normally; memory flush is an asynchronously triggered side effect.") },
      ],
      control: [
        { name: l("Memory Flush Trigger", "Memory Flush Trigger"), detail: l("flush 命令或自动条件触发 memory 写入。", "The /memory flush command or automatic conditions trigger the write."), fresh: true },
        { name: l("Memory Loader (启动时)", "Memory Loader (startup)"), detail: l("启动时读取 MEMORY.md 并注入 system prompt。", "On startup, reads MEMORY.md and injects it into the system prompt."), fresh: true },
      ],
      state: [
        { name: l("MEMORY.md (持久文件)", "MEMORY.md (persistent file)"), detail: l("跨会话的结构化知识，由 agent 主动维护。", "Cross-session structured knowledge actively maintained by the agent."), fresh: true },
        { name: l("memory_sections (注入内容)", "memory_sections (injected)"), detail: l("从 MEMORY.md 解析后注入 system prompt 的内容块。", "Blocks parsed from MEMORY.md and injected into the system prompt."), fresh: true },
      ],
    },
    handoff: [
      l("触发 /memory flush 或自动条件", "Trigger /memory flush or automatic condition"),
      l("将当前知识摘要写入 MEMORY.md", "Write current knowledge summary to MEMORY.md"),
      l("下次启动读取 MEMORY.md 注入 system prompt", "Next startup reads MEMORY.md and injects into system prompt"),
    ],
  },

  h08: {
    summary: l(
      "按需激活专业操作指南——注入为 user message 而非 system prompt，避免破坏 prefix cache。",
      "Activates domain-specific operation guides on demand — injected as a user message rather than system prompt to avoid breaking the prefix cache."
    ),
    slices: {
      mainline: [
        { name: l("Main Loop", "Main Loop"), detail: l("主循环不变，skill 注入是模型触发的一次性 user message。", "Main loop unchanged; skill injection is a one-time model-triggered user message.") },
      ],
      control: [
        { name: l("Skill Loader (/skill-name)", "Skill Loader (/skill-name)"), detail: l("解析 /skill-name 指令，从 skills/ 目录加载对应 markdown 文件。", "Parses /skill-name commands and loads the corresponding markdown from skills/."), fresh: true },
        { name: l("_build_skill_message", "_build_skill_message"), detail: l("把 skill 内容格式化为 user message payload，含 activation_note。", "Formats skill content into a user message payload including an activation_note."), fresh: true },
      ],
      state: [
        { name: l("_skill_commands{}", "_skill_commands{}"), detail: l("已注册的 skill 名称到目录的映射。", "Mapping of registered skill names to their directories."), fresh: true },
        { name: l("loaded_skill{}", "loaded_skill{}"), detail: l("当前激活的 skill 内容和配置。", "Content and config of the currently active skill."), fresh: true },
      ],
    },
    handoff: [
      l("模型触发 /skill-name 指令", "Model triggers /skill-name command"),
      l("Skill Loader 读取 skill.md 并构建 user message", "Skill Loader reads skill.md and builds user message"),
      l("user message 注入对话，模型按 skill 指引行动", "User message injected into conversation; model acts per skill guide"),
    ],
  },

  h09: {
    summary: l(
      "工具执行前插入人机确认门——Approval 层按策略决定是否放行，结果结构化记录回主循环。",
      "Inserts a human-machine confirmation gate before tool execution — the Approval layer decides by policy whether to proceed, and the result is structurally recorded back into the loop."
    ),
    slices: {
      mainline: [
        { name: l("Main Loop", "Main Loop"), detail: l("dispatch 之前插入 Approval Gate，通过才执行工具。", "Approval Gate is inserted before dispatch; tool executes only if approved.") },
      ],
      control: [
        { name: l("ApprovalPolicy", "ApprovalPolicy"), detail: l("规则引擎：工具风险级别 × 当前模式 → 放行/拒绝/询问。", "Rule engine: tool risk level × current mode → allow / deny / ask."), fresh: true },
        { name: l("Permission Gate", "Permission Gate"), detail: l("实际阻塞工具执行，等待用户确认或拒绝。", "Actually blocks tool execution and waits for user confirmation or denial."), fresh: true },
      ],
      state: [
        { name: l("ApprovalResult", "ApprovalResult"), detail: l("记录放行/拒绝结果和用户理由，回写到 tool_result。", "Records allow/deny result and user rationale; written back as tool_result."), fresh: true },
        { name: l("permission_record", "permission_record"), detail: l("已授权工具的持久白名单，避免重复询问。", "Persistent whitelist of approved tools to avoid repeated prompts."), fresh: true },
      ],
    },
    handoff: [
      l("工具调用意图到达 Approval Gate", "Tool call intent reaches the Approval Gate"),
      l("ApprovalPolicy 判断是否需要用户确认", "ApprovalPolicy determines whether user confirmation is required"),
      l("放行则执行，拒绝则构造拒绝 tool_result 回写主循环", "If approved, execute; if denied, construct denial tool_result and write back"),
    ],
  },

  h10: {
    summary: l(
      "API 错误分类 + 指数退避重试 + fallback 降级——任何 transient 错误都不中断主循环。",
      "API error classification + exponential backoff retry + fallback degradation — any transient error leaves the main loop intact."
    ),
    slices: {
      mainline: [
        { name: l("Main Loop (受保护)", "Main Loop (protected)"), detail: l("所有 API 调用包裹在 try/except 里，错误由 _handle_api_error 处理。", "All API calls are wrapped in try/except; errors are handled by _handle_api_error.") },
      ],
      control: [
        { name: l("_handle_api_error", "_handle_api_error"), detail: l("分类错误（rate limit / server / auth），决定重试还是 fallback。", "Classifies errors (rate limit / server / auth) and decides retry or fallback."), fresh: true },
        { name: l("RetryConfig (指数退避)", "RetryConfig (exponential backoff)"), detail: l("初始间隔 × 指数增长，最大重试次数可配。", "Initial interval × exponential growth; max retry count is configurable."), fresh: true },
      ],
      state: [
        { name: l("error_count", "error_count"), detail: l("当前连续错误次数，达到上限触发 fallback。", "Current consecutive error count; triggers fallback when limit is reached."), fresh: true },
        { name: l("fallback_response", "fallback_response"), detail: l("重试耗尽后注入的降级消息，让 agent 优雅退出当前任务。", "Degraded message injected when retries are exhausted, allowing graceful task exit."), fresh: true },
      ],
    },
    handoff: [
      l("捕获 API 错误，_handle_api_error 分类", "Catch API error; _handle_api_error classifies it"),
      l("transient 错误：指数退避后重试", "Transient error: retry after exponential backoff"),
      l("重试耗尽或 fatal 错误：注入 fallback_response 继续主循环", "Retries exhausted or fatal: inject fallback_response and continue loop"),
    ],
  },

  h11: {
    summary: l(
      "CommandDef 注册表统一管理所有 slash 命令——CLI / Gateway / Telegram 共用同一套定义，逻辑路由集中。",
      "CommandDef registry centralizes all slash commands — CLI, Gateway, and Telegram share one definition set with centralized logic routing."
    ),
    slices: {
      mainline: [
        { name: l("CLI Command Routing", "CLI Command Routing"), detail: l("用户输入的 /command 经注册表解析后路由到对应 handler。", "User /command input is parsed via registry and routed to the correct handler."), fresh: true },
      ],
      control: [
        { name: l("COMMAND_REGISTRY", "COMMAND_REGISTRY"), detail: l("所有 CommandDef 的中央列表，单一事实来源。", "Central list of all CommandDefs — the single source of truth."), fresh: true },
        { name: l("CommandDef", "CommandDef"), detail: l("描述命令的 name / aliases / category / args_hint / subcommands / cli_only / gateway_only。", "Describes name / aliases / category / args_hint / subcommands / cli_only / gateway_only."), fresh: true },
      ],
      state: [
        { name: l("command_context", "command_context"), detail: l("命令执行时的上下文：session_id、当前 locale、参数等。", "Execution context for the command: session_id, current locale, args, etc."), fresh: true },
      ],
    },
    handoff: [
      l("用户输入 /command-name [args]", "User inputs /command-name [args]"),
      l("COMMAND_REGISTRY 查找匹配的 CommandDef（含 aliases）", "COMMAND_REGISTRY finds matching CommandDef (including aliases)"),
      l("路由到对应 handler，执行并返回结果到会话", "Route to handler, execute, and return result to session"),
    ],
  },

  h12: {
    summary: l(
      "HTTP API 层包装 agent 主循环——多会话并发、SSE 流式推送、session_map 隔离每个对话状态。",
      "HTTP API wraps the agent main loop — multi-session concurrency, SSE streaming, and session_map isolates each conversation's state."
    ),
    slices: {
      mainline: [
        { name: l("HTTP Request → Agent Loop", "HTTP Request → Agent Loop"), detail: l("POST /run 携带 session_id，路由到对应 agent 实例，结果 SSE 返回。", "POST /run carries session_id, routes to the correct agent instance, result returned via SSE."), fresh: true },
      ],
      lanes: [
        { name: l("Session Manager (并发)", "Session Manager (concurrent)"), detail: l("session_map 维护多个并发 agent 实例，每个会话隔离。", "session_map maintains multiple concurrent agent instances; each session is isolated."), fresh: true },
        { name: l("SSE Stream (流式推送)", "SSE Stream (streaming)"), detail: l("模型输出实时推送到客户端，不等整个响应完成。", "Model output is pushed to the client in real-time without waiting for the full response."), fresh: true },
      ],
      state: [
        { name: l("session_map", "session_map"), detail: l("{ session_id → AgentState } 的并发字典。", "{ session_id → AgentState } concurrent dictionary."), fresh: true },
        { name: l("StreamToken", "StreamToken"), detail: l("SSE 事件的最小单元，携带 delta 文本或工具调用片段。", "Minimum SSE event unit carrying delta text or tool call fragment."), fresh: true },
      ],
    },
    handoff: [
      l("POST /run { session_id, message } 到达 Gateway", "POST /run { session_id, message } arrives at Gateway"),
      l("session_map 路由到对应 agent 实例", "session_map routes to the correct agent instance"),
      l("agent loop 输出以 SSE 流式返回客户端", "Agent loop output streamed back to client via SSE"),
    ],
  },

  h13: {
    summary: l(
      "cron 表达式触发无头 agent 循环——不需要人类消息，系统自动构造触发消息启动任务。",
      "Cron expressions trigger a headless agent loop — no human message needed; the system constructs the trigger message automatically."
    ),
    slices: {
      mainline: [
        { name: l("Cron Scheduler → Agent Loop", "Cron Scheduler → Agent Loop"), detail: l("定时触发构造系统消息，启动无头 agent 循环。", "Scheduled trigger constructs a system message and starts a headless agent loop."), fresh: true },
      ],
      lanes: [
        { name: l("CronJob Worker", "CronJob Worker"), detail: l("独立进程/协程，按 cron 表达式调度触发。", "Independent process/coroutine scheduled by cron expression."), fresh: true },
        { name: l("Headless Agent Loop", "Headless Agent Loop"), detail: l("无交互输入的 agent 循环，只有系统触发消息。", "Agent loop without interactive input — only system trigger messages."), fresh: true },
      ],
      state: [
        { name: l("CronDef", "CronDef"), detail: l("描述调度规则：表达式 / 触发消息 / 目标 session。", "Describes scheduling rule: expression / trigger message / target session."), fresh: true },
        { name: l("last_run_time", "last_run_time"), detail: l("上次执行时间，用于补偿错过的触发。", "Last execution time, used to compensate for missed triggers."), fresh: true },
      ],
    },
    handoff: [
      l("Cron Scheduler 按表达式触发", "Cron Scheduler fires based on expression"),
      l("构造系统触发消息（含任务描述）", "Construct system trigger message (with task description)"),
      l("启动无头 agent loop，任务完成后记录 last_run_time", "Start headless agent loop; record last_run_time after completion"),
    ],
  },

  h14: {
    summary: l(
      "生命周期 Hook 系统——agent 循环关键点发出事件，注册的 handler 可注入副作用而不修改主线。",
      "Lifecycle hook system — the agent loop emits events at key points; registered handlers inject side effects without touching the mainline."
    ),
    slices: {
      mainline: [
        { name: l("Main Loop (发出事件)", "Main Loop (event emitter)"), detail: l("主循环在 before_tool / after_tool / on_error 等点发出 HookEnvelope。", "The main loop emits HookEnvelopes at before_tool / after_tool / on_error etc."), fresh: true },
      ],
      control: [
        { name: l("Hook Dispatcher", "Hook Dispatcher"), detail: l("收到 HookEnvelope 后并发分发给所有已注册 handler。", "On receiving HookEnvelope, concurrently dispatches to all registered handlers."), fresh: true },
        { name: l("HookEnvelope", "HookEnvelope"), detail: l("标准化的 hook 消息格式，携带事件类型和上下文数据。", "Standardized hook message format carrying event type and context data."), fresh: true },
      ],
      lanes: [
        { name: l("Audit Handler (审计)", "Audit Handler"), detail: l("记录工具调用日志到外部系统，不阻塞主线。", "Logs tool calls to external systems without blocking the mainline."), fresh: true },
        { name: l("Custom Hook Handler", "Custom Hook Handler"), detail: l("用户自定义副作用：通知、缓存、监控等。", "User-defined side effects: notifications, caching, monitoring, etc."), fresh: true },
      ],
    },
    handoff: [
      l("主循环到达 hook point，发出 HookEnvelope", "Main loop reaches hook point and emits HookEnvelope"),
      l("Hook Dispatcher 并发通知所有已注册 handler", "Hook Dispatcher notifies all registered handlers concurrently"),
      l("副作用异步执行，主循环不等待结果继续", "Side effects execute asynchronously; main loop continues without waiting"),
    ],
  },

  h15: {
    summary: l(
      "主 agent 将子任务委托给独立子 agent——每个子 agent 有自己的 tool loop，结果汇报回主线。",
      "The main agent delegates subtasks to independent subagents — each subagent has its own tool loop and reports results back to the mainline."
    ),
    slices: {
      mainline: [
        { name: l("Parent Agent Loop", "Parent Agent Loop"), detail: l("主 agent 产出委托指令，等待子 agent 结果后继续。", "Main agent emits delegation instruction, then waits for subagent result before continuing.") },
      ],
      lanes: [
        { name: l("Subagent Loop (独立)", "Subagent Loop (independent)"), detail: l("子 agent 有独立的 messages[]、工具集和主循环。", "Subagent has independent messages[], tool set, and main loop."), fresh: true },
        { name: l("Tool Pool (共享)", "Tool Pool (shared)"), detail: l("主 agent 和子 agent 可共享工具定义，但各自独立执行。", "Main and subagent share tool definitions but execute them independently."), fresh: true },
      ],
      state: [
        { name: l("SubagentSpec", "SubagentSpec"), detail: l("描述子任务的目标、工具权限和 session 隔离策略。", "Describes subtask goal, tool permissions, and session isolation strategy."), fresh: true },
        { name: l("delegation_result", "delegation_result"), detail: l("子 agent 完成后返回的结构化结果，回写到主 agent messages[]。", "Structured result returned by subagent on completion; written back to parent messages[]."), fresh: true },
      ],
    },
    handoff: [
      l("主 agent 产出委托指令（含 SubagentSpec）", "Parent agent emits delegation instruction (with SubagentSpec)"),
      l("启动独立 subagent loop 执行子任务", "Launch independent subagent loop to execute the subtask"),
      l("子 agent 返回 delegation_result，主 agent 继续", "Subagent returns delegation_result; parent agent continues"),
    ],
  },

  h16: {
    summary: l(
      "抽象 Provider 层统一多后端——一套 agent 接口同时支持 OpenAI / Anthropic / Gemini，切换不改主循环。",
      "The abstract Provider layer unifies multiple backends — one agent interface supports OpenAI / Anthropic / Gemini; switching backends doesn't touch the main loop."
    ),
    slices: {
      mainline: [
        { name: l("Agent Loop (后端无关)", "Agent Loop (backend-agnostic)"), detail: l("主循环只调用 Provider 接口，不直接依赖任何具体 SDK。", "Main loop only calls the Provider interface; no direct dependency on any specific SDK."), fresh: true },
      ],
      control: [
        { name: l("Provider Dispatcher", "Provider Dispatcher"), detail: l("根据配置路由到正确的后端实现。", "Routes to the correct backend implementation based on config."), fresh: true },
        { name: l("ProviderConfig", "ProviderConfig"), detail: l("base_url / api_key / model_name 的统一配置结构。", "Unified config structure for base_url / api_key / model_name."), fresh: true },
      ],
      lanes: [
        { name: l("OpenAI / Compatible Backend", "OpenAI / Compatible Backend"), detail: l("默认后端，对接 OpenAI SDK 或 Hermes 兼容服务。", "Default backend connecting to OpenAI SDK or Hermes-compatible service."), fresh: true },
        { name: l("Anthropic Backend", "Anthropic Backend"), detail: l("Anthropic claude-* 模型后端，消息格式略有差异。", "Anthropic claude-* backend with slightly different message format."), fresh: true },
      ],
    },
    handoff: [
      l("agent 调用 Provider.complete(messages, tools)", "Agent calls Provider.complete(messages, tools)"),
      l("Provider Dispatcher 按 ProviderConfig 路由到后端", "Provider Dispatcher routes to backend based on ProviderConfig"),
      l("后端返回统一格式响应，agent loop 继续", "Backend returns unified-format response; agent loop continues"),
    ],
  },

  h17: {
    summary: l(
      "MCP JSON-RPC 握手 + list_tools 动态发现 → 注入到 ToolRegistry，走同一 dispatch 路径，MCP 工具不是外挂。",
      "MCP JSON-RPC handshake + list_tools dynamic discovery → injected into ToolRegistry, following the same dispatch path — MCP tools are not plug-ins."
    ),
    slices: {
      mainline: [
        { name: l("Main Loop (工具透明)", "Main Loop (tool-transparent)"), detail: l("主循环不区分原生工具和 MCP 工具，全部经 ToolRegistry dispatch。", "Main loop doesn't distinguish native vs MCP tools; all go through ToolRegistry dispatch.") },
      ],
      control: [
        { name: l("MCP Client (握手)", "MCP Client (handshake)"), detail: l("建立 JSON-RPC 连接，获取 server capabilities。", "Establishes JSON-RPC connection and fetches server capabilities."), fresh: true },
        { name: l("Tool Discovery (list_tools)", "Tool Discovery (list_tools)"), detail: l("调用 list_tools 获取 schema 列表，动态注册到 ToolRegistry。", "Calls list_tools to get schema list and dynamically registers into ToolRegistry."), fresh: true },
      ],
      lanes: [
        { name: l("MCP Server (外部进程)", "MCP Server (external process)"), detail: l("独立进程或服务，通过 stdio / HTTP 暴露工具能力。", "Independent process or service exposing tool capabilities via stdio / HTTP."), fresh: true },
      ],
    },
    handoff: [
      l("MCP Client 与 Server 握手，协商协议版本", "MCP Client handshakes with Server, negotiates protocol version"),
      l("list_tools → 获取 schema 列表 → 注册到 ToolRegistry", "list_tools → fetch schema list → register into ToolRegistry"),
      l("agent 调用 MCP 工具与调用原生工具路径完全相同", "Agent calls MCP tools via the exact same path as native tools"),
    ],
  },

  h18: {
    summary: l(
      "PluginContext API 提供三种扩展点——register_tool / register_hook / register_command，不 fork 代码即可扩展 Hermes。",
      "PluginContext API provides three extension points — register_tool / register_hook / register_command — extending Hermes without forking the codebase."
    ),
    slices: {
      mainline: [
        { name: l("Main Loop (插件透明)", "Main Loop (plugin-transparent)"), detail: l("插件注册完成后主循环感知不到插件的存在，统一走标准路径。", "After plugin registration, the main loop is unaware of plugins — everything goes through standard paths.") },
      ],
      control: [
        { name: l("PluginContext API", "PluginContext API"), detail: l("register_tool / register_hook / register_command 三个注册方法。", "Three registration methods: register_tool / register_hook / register_command."), fresh: true },
        { name: l("Plugin Loader (3 种发现源)", "Plugin Loader (3 discovery sources)"), detail: l("文件系统目录 / 入口点 / 配置列表，自动发现并加载插件。", "File system directory / entry points / config list — auto-discovers and loads plugins."), fresh: true },
      ],
      lanes: [
        { name: l("Plugin (外部包/目录)", "Plugin (external package/dir)"), detail: l("实现 setup(PluginContext) 接口的任意 Python 包。", "Any Python package implementing the setup(PluginContext) interface."), fresh: true },
        { name: l("Hook System (共用)", "Hook System (shared)"), detail: l("plugin register_hook 会接入已有的 Hook Dispatcher。", "plugin register_hook plugs into the existing Hook Dispatcher.") },
      ],
    },
    handoff: [
      l("Plugin Loader 发现并导入插件包", "Plugin Loader discovers and imports plugin package"),
      l("调用 plugin.setup(PluginContext)，插件完成注册", "Call plugin.setup(PluginContext); plugin completes registration"),
      l("工具/钩子/命令生效，主循环无需修改", "Tools / hooks / commands are live; main loop needs no modification"),
    ],
  },

  h19: {
    summary: l(
      "batch_runner 并行生成轨迹 + trajectory_compressor 过滤清洗 + ShareGPT 格式化，输入 Atropos RL 训练管线。",
      "batch_runner generates trajectories in parallel + trajectory_compressor filters and cleans + ShareGPT formatting feeds the Atropos RL training pipeline."
    ),
    slices: {
      mainline: [
        { name: l("Batch Runner (并行生成)", "Batch Runner (parallel generation)"), detail: l("并行启动多个 agent 实例执行任务，收集完整轨迹。", "Launches multiple agent instances in parallel to execute tasks and collect full trajectories."), fresh: true },
      ],
      lanes: [
        { name: l("Parallel Agent Workers", "Parallel Agent Workers"), detail: l("每个 worker 是独立的 agent loop，轨迹互不干扰。", "Each worker is an independent agent loop; trajectories are isolated."), fresh: true },
        { name: l("Trajectory Filter (清洗)", "Trajectory Filter (cleaning)"), detail: l("过滤不完整、有工具错误或 token 超限的低质量轨迹。", "Filters incomplete trajectories, tool errors, or token-overlimit low-quality records."), fresh: true },
      ],
      state: [
        { name: l("TrajectoryRecord", "TrajectoryRecord"), detail: l("原始轨迹：完整 messages[] + 工具调用历史 + 元数据。", "Raw trajectory: full messages[] + tool call history + metadata."), fresh: true },
        { name: l("filtered_batch (ShareGPT 格式)", "filtered_batch (ShareGPT format)"), detail: l("过滤并转换为 ShareGPT 格式的训练数据集。", "Filtered and converted training dataset in ShareGPT format."), fresh: true },
      ],
    },
    handoff: [
      l("Batch Runner 并行调度多个 agent worker 生成原始轨迹", "Batch Runner schedules multiple agent workers in parallel to generate raw trajectories"),
      l("Trajectory Filter 过滤低质量轨迹，保留有效样本", "Trajectory Filter removes low-quality trajectories and keeps valid samples"),
      l("trajectory_compressor 转换为 ShareGPT 格式，写入训练集", "trajectory_compressor converts to ShareGPT format and writes to training set"),
    ],
  },
};
