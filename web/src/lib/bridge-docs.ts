import type { Version } from "./constants";
import docsData from "@/data/generated/docs.json";

type Locale = "zh" | "en";
type BridgeDocKind = "overview" | "mechanism" | "reference";

type DocRecord = {
  slug: string;
  locale: Locale;
  kind: "chapter" | "bridge";
  title: string;
  summary: string;
  version: Version | null;
};

export interface BridgeDocMeta {
  slug: string;
  kind: BridgeDocKind;
  title: Partial<Record<Locale, string>>;
  summary: Partial<Record<Locale, string>>;
  badge: Partial<Record<Locale, string>>;
  whenToRead: Partial<Record<Locale, string>>;
  relatedVersions: Version[];
  relatedDocSlugs: string[];
}

const ALL_DOCS = docsData as DocRecord[];
const BRIDGE_KIND_LABELS: Record<BridgeDocKind, Record<Locale, string>> = {
  overview: { zh: "总览地图", en: "Overview Map" },
  mechanism: { zh: "机制补充", en: "Mechanism Note" },
  reference: { zh: "参考资料", en: "Reference Note" },
};

const FULL_CHAPTER_SET: Version[] = [
  "h01", "h02", "h03", "h04", "h05", "h06",
  "h07", "h08", "h09", "h10", "h11",
  "h12", "h13", "h14", "h15",
  "h16", "h17", "h18", "h19",
];

const BRIDGE_DEFINITIONS: Record<string, Omit<BridgeDocMeta, "title" | "summary"> & {
  title?: Partial<Record<Locale, string>>;
  summary?: Partial<Record<Locale, string>>;
}> = {
  "h00-architecture-overview": {
    slug: "h00-architecture-overview",
    kind: "overview",
    badge: { zh: "课程地图", en: "Course Map" },
    whenToRead: {
      zh: "适合在刚进入课程、章节关系开始混淆，或需要重新校准 19 章全局位置时回看。",
      en: "Best when starting the course, when chapter boundaries blur, or when you need to re-anchor the full 19-chapter map.",
    },
    relatedVersions: FULL_CHAPTER_SET,
    relatedDocSlugs: ["glossary", "data-structures"],
  },
  glossary: {
    slug: "glossary",
    kind: "reference",
    title: { zh: "术语表", en: "Glossary" },
    summary: {
      zh: "统一 Hermes 教学项目中的高频名词边界，避免 tool、session、memory、skill 等概念在阅读中互相混淆。",
      en: "A shared vocabulary for the Hermes curriculum so terms like tool, session, memory, and skill stay crisp while reading.",
    },
    badge: { zh: "术语索引", en: "Term Index" },
    whenToRead: {
      zh: "适合在第一次读到陌生术语、或多章概念开始串线时回查。",
      en: "Use it when a new term appears or when concepts from multiple chapters start to blend together.",
    },
    relatedVersions: FULL_CHAPTER_SET,
    relatedDocSlugs: ["h00-architecture-overview", "data-structures"],
  },
  "data-structures": {
    slug: "data-structures",
    kind: "reference",
    title: { zh: "核心数据结构速查", en: "Data Structures" },
    summary: {
      zh: "集中整理消息、tool call、session、memory、provider config 等关键记录结构，帮助你快速定位状态到底存在哪里。",
      en: "A compact map of key records like messages, tool calls, sessions, memory, and provider config so state locations stay clear.",
    },
    badge: { zh: "结构地图", en: "Structure Map" },
    whenToRead: {
      zh: "适合在开始追踪状态流、读源码字段、或比较章节之间数据边界时回看。",
      en: "Best when tracking state flow, reading source-level fields, or comparing data boundaries across chapters.",
    },
    relatedVersions: FULL_CHAPTER_SET,
    relatedDocSlugs: ["h00-architecture-overview", "glossary"],
  },
  "h03a-agent-level-tools": {
    slug: "h03a-agent-level-tools",
    kind: "mechanism",
    title: { zh: "Agent-level Tools", en: "Agent-level Tools" },
    summary: {
      zh: "解释为什么 todo、session_search、memory_write 这类工具更接近 agent 控制面，而不只是普通注册表工具。",
      en: "Explains why tools like todo, session_search, and memory_write belong closer to the agent control plane than ordinary registry tools.",
    },
    badge: { zh: "控制面补充", en: "Control Plane Note" },
    whenToRead: {
      zh: "适合在你已经理解 todo 拦截流程，但开始疑惑哪些 tool 应该算 agent 内部能力时回看。",
      en: "Best once you understand todo interception but start wondering which tools really belong to the agent's internal control plane.",
    },
    relatedVersions: ["h03", "h06", "h07"],
    relatedDocSlugs: ["h06a-session-search", "data-structures"],
  },
  "h04a-prompt-caching": {
    slug: "h04a-prompt-caching",
    kind: "mechanism",
    title: { zh: "Prompt Caching", en: "Prompt Caching" },
    summary: {
      zh: "解释为什么 prompt 的稳定前缀会反过来约束 PromptBuilder 的 section 顺序，以及 skill 为何更适合用 user message 注入。",
      en: "Explains how prompt-cache-friendly stable prefixes shape PromptBuilder ordering and why skills are better injected as user messages.",
    },
    badge: { zh: "性能机制", en: "Performance Note" },
    whenToRead: {
      zh: "适合在你已经理解 section 组装，却还没看清为什么顺序稳定性会影响成本和延迟时回看。",
      en: "Best when you already understand section assembly but haven’t yet connected ordering stability to latency and cost.",
    },
    relatedVersions: ["h04", "h08"],
    relatedDocSlugs: ["h08a-skill-injection-boundary", "glossary", "data-structures"],
  },
  "h05a-lineage-model": {
    slug: "h05a-lineage-model",
    kind: "mechanism",
    title: { zh: "Lineage Model", en: "Lineage Model" },
    summary: {
      zh: "解释为什么压缩后的 session 应该生成新的谱系节点，而不是覆盖原历史，以及这如何支撑搜索、恢复与审计。",
      en: "Explains why compressed sessions should form new lineage nodes instead of overwriting history, and how that supports search, recovery, and auditability.",
    },
    badge: { zh: "谱系机制", en: "Lineage Note" },
    whenToRead: {
      zh: "适合在你已经知道 compression 要做摘要，但还没想透 parent_session_id 为何重要时回看。",
      en: "Best after you understand summarizing compression but before parent_session_id fully clicks as a structural requirement.",
    },
    relatedVersions: ["h05", "h06"],
    relatedDocSlugs: ["h06a-session-search", "h07a-memory-vs-session", "data-structures"],
  },
  "h06a-session-search": {
    slug: "h06a-session-search",
    kind: "mechanism",
    title: { zh: "Session Search", en: "Session Search" },
    summary: {
      zh: "解释为什么 session_search 不只是数据库查询，而是 agent 把历史会话重新带回当前推理链的回忆机制。",
      en: "Explains why session_search is more than a database query: it is how the agent brings prior sessions back into the current reasoning loop.",
    },
    badge: { zh: "历史检索", en: "History Retrieval" },
    whenToRead: {
      zh: "适合在你已经理解 SQLite + FTS5 持久化，但开始思考它们如何真正进入 agent loop 时回看。",
      en: "Best once SQLite + FTS5 persistence makes sense, but you still need to connect that storage layer back into the live agent loop.",
    },
    relatedVersions: ["h03", "h05", "h06", "h07"],
    relatedDocSlugs: ["h03a-agent-level-tools", "h05a-lineage-model", "h07a-memory-vs-session"],
  },
  "h07a-memory-vs-session": {
    slug: "h07a-memory-vs-session",
    kind: "mechanism",
    title: { zh: "Memory vs Session", en: "Memory vs Session" },
    summary: {
      zh: "解释为什么保存完整会话历史不等于形成长期记忆，以及 session、memory、session_search 三者如何分层协作。",
      en: "Explains why saving full session history is not the same as forming long-term memory, and how session, memory, and session_search cooperate across layers.",
    },
    badge: { zh: "边界校准", en: "Boundary Note" },
    whenToRead: {
      zh: "适合在你已经理解 session storage 和 memory flush，但仍混淆“保存历史”和“记住结论”的区别时回看。",
      en: "Best when session storage and memory flush both make sense, but the boundary between preserving history and retaining conclusions still feels blurry.",
    },
    relatedVersions: ["h06", "h07"],
    relatedDocSlugs: ["h06a-session-search", "h05a-lineage-model", "data-structures"],
  },
  "h11a-command-registry-routing": {
    slug: "h11a-command-registry-routing",
    kind: "mechanism",
    title: { zh: "Command Registry Routing", en: "Command Registry Routing" },
    summary: {
      zh: "解释为什么 slash command 真正统一的不是命令名字符串，而是可跨 CLI、Gateway、Telegram 复用的命令描述与路由对象。",
      en: "Explains why slash commands are unified not by string matching, but by reusable command descriptors and routing metadata shared across CLI, Gateway, and Telegram.",
    },
    badge: { zh: "路由补充", en: "Routing Note" },
    whenToRead: {
      zh: "适合在你已经理解 `COMMAND_REGISTRY` 和 `CommandDef` 字段后，再回来看清“统一命令名”背后真正统一的是路由描述对象。",
      en: "Best once `COMMAND_REGISTRY` and `CommandDef` make sense, but you still need to see that the true abstraction is the shared routing descriptor, not the command string itself.",
    },
    relatedVersions: ["h11", "h12"],
    relatedDocSlugs: ["h12a-session-routing", "glossary", "data-structures"],
  },
  "h12a-session-routing": {
    slug: "h12a-session-routing",
    kind: "mechanism",
    title: { zh: "Session Routing", en: "Session Routing" },
    summary: {
      zh: "解释为什么 Gateway 的核心不是接入更多平台，而是让每条消息稳定落到正确的会话边界里。",
      en: "Explains why the gateway’s core challenge is not connecting more platforms, but routing every message into the correct session boundary.",
    },
    badge: { zh: "会话路由", en: "Session Note" },
    whenToRead: {
      zh: "适合在你已经理解 `MessageEvent` 统一格式后，再回来看清 platform/user/chat 三维 session key 为什么决定上下文隔离质量。",
      en: "Best after `MessageEvent` feels familiar, when you want to understand why the platform/user/chat session key is the real boundary keeper for context isolation.",
    },
    relatedVersions: ["h11", "h12", "h13"],
    relatedDocSlugs: ["h11a-command-registry-routing", "h13a-agentic-cron", "data-structures"],
  },
  "h13a-agentic-cron": {
    slug: "h13a-agentic-cron",
    kind: "mechanism",
    title: { zh: "Agentic Cron", en: "Agentic Cron" },
    summary: {
      zh: "解释为什么 Hermes 的 cron 不只是脚本调度，而是按时触发一次完整的 agent 执行过程。",
      en: "Explains why Hermes cron is not mere script scheduling, but a time-triggered entry into a full agent execution workflow.",
    },
    badge: { zh: "定时执行补充", en: "Cron Note" },
    whenToRead: {
      zh: "适合在你已经理解 scheduler tick 和 fresh agent 后，再回来看清 cron 在 Hermes 里为什么更像新的 runtime 入口，而不是后台脚本。",
      en: "Best once scheduler ticks and fresh agents are clear, but you still want to see why cron is treated as another runtime entrypoint rather than a background script.",
    },
    relatedVersions: ["h12", "h13", "h15"],
    relatedDocSlugs: ["h12a-session-routing", "h15a-budget-sharing", "glossary"],
  },
  "h14a-hook-boundary": {
    slug: "h14a-hook-boundary",
    kind: "mechanism",
    title: { zh: "Hook Boundary", en: "Hook Boundary" },
    summary: {
      zh: "解释为什么 hook 的价值来自它只负责观察与注解，而不接管主循环控制流。",
      en: "Explains why hooks are valuable precisely because they stay on the observation-and-annotation side instead of taking over the main control flow.",
    },
    badge: { zh: "扩展边界", en: "Extension Boundary" },
    whenToRead: {
      zh: "适合在你已经理解 hook 生命周期后，再回来看清它为什么不能和 approval、dispatch、agent-level tool 一样掌控运行时决策。",
      en: "Best after hook lifecycles make sense, when you need to separate them cleanly from approval, dispatch, and other control-plane decisions.",
    },
    relatedVersions: ["h09", "h14", "h18"],
    relatedDocSlugs: ["h09a-approval-pipeline", "h08a-skill-injection-boundary", "glossary"],
  },
  "h15a-budget-sharing": {
    slug: "h15a-budget-sharing",
    kind: "mechanism",
    title: { zh: "Budget Sharing", en: "Budget Sharing" },
    summary: {
      zh: "解释为什么 subagent 真正防失控的关键不是并发线程数，而是整棵任务树共享同一份迭代预算。",
      en: "Explains why the real guardrail in subagent systems is not worker count, but a shared iteration budget across the whole task tree.",
    },
    badge: { zh: "预算约束", en: "Budget Note" },
    whenToRead: {
      zh: "适合在你已经理解 context isolation 和 delegation 并发后，再回来看清父子 agent 为什么必须共用同一份成本上限。",
      en: "Best once context isolation and parallel delegation are familiar, but you still need to see why parent and child agents must spend from the same budget ceiling.",
    },
    relatedVersions: ["h13", "h15", "h16"],
    relatedDocSlugs: ["h13a-agentic-cron", "h10a-fallback-taxonomy", "data-structures"],
  },
  "h16a-runtime-route": {
    slug: "h16a-runtime-route",
    kind: "mechanism",
    title: { zh: "Runtime Route", en: "Runtime Route" },
    summary: {
      zh: "解释为什么 provider runtime 真正统一的不是厂商名，而是每一轮调用开始前被解析出的统一 route 结果。",
      en: "Explains why provider runtime is unified not by vendor names, but by the route object resolved at the start of each turn.",
    },
    badge: { zh: "路由抽象", en: "Route Abstraction" },
    whenToRead: {
      zh: "适合在你已经理解 api_mode 和 credential resolution 后，再回来看清 provider、fallback、credential pool 为什么最终都要压平为同一种 turn-level route。",
      en: "Best once api_mode and credential resolution make sense, but you still need to see how provider selection, fallback, and credential pools all collapse into one turn-level route abstraction.",
    },
    relatedVersions: ["h10", "h16"],
    relatedDocSlugs: ["h10a-fallback-taxonomy", "h15a-budget-sharing", "data-structures"],
  },
  "h17a-mcp-capability-layers": {
    slug: "h17a-mcp-capability-layers",
    kind: "mechanism",
    title: { zh: "MCP Capability Layers", en: "MCP Capability Layers" },
    summary: {
      zh: "解释为什么 MCP 不只是外部工具接入，而是从配置、连接、认证到能力暴露的一组平台层能力面。",
      en: "Explains why MCP is more than external tool wiring: it is a platform surface spanning config, connection, auth, and capability exposure.",
    },
    badge: { zh: "能力层地图", en: "Capability Map" },
    whenToRead: {
      zh: "适合在你已经理解 tools-first 的 MCP 接入后，再回来看清 tools 只是 MCP capability layers 中最先进入主线的一层。",
      en: "Best after the tools-first MCP path makes sense, when you want to place tools inside the larger set of MCP capability layers.",
    },
    relatedVersions: ["h17", "h18"],
    relatedDocSlugs: ["h18a-plugin-boundary", "glossary", "data-structures"],
  },
  "h18a-plugin-boundary": {
    slug: "h18a-plugin-boundary",
    kind: "mechanism",
    title: { zh: "Plugin Boundary", en: "Plugin Boundary" },
    summary: {
      zh: "解释为什么 plugin 扩展的是能力装配层，而不是像 skill 一样直接扩展模型的行为提示层。",
      en: "Explains why plugins extend the capability-assembly layer rather than the model-facing behavior-guidance layer used by skills.",
    },
    badge: { zh: "插件边界", en: "Plugin Boundary" },
    whenToRead: {
      zh: "适合在你已经理解 plugin 能注册 tool、hook、command 后，再回来看清它和 skill、hook 分别处在哪个层级。",
      en: "Best after plugin tools, hooks, and commands make sense, when you need to separate plugins cleanly from skills and hooks by layer.",
    },
    relatedVersions: ["h08", "h14", "h18"],
    relatedDocSlugs: ["h08a-skill-injection-boundary", "h14a-hook-boundary", "glossary"],
  },
  "h19a-training-data-boundary": {
    slug: "h19a-training-data-boundary",
    kind: "mechanism",
    title: { zh: "Training Data Boundary", en: "Training Data Boundary" },
    summary: {
      zh: "解释为什么 trajectory 收集的难点不在于能否保存，而在于什么样的轨迹值得进入训练集。",
      en: "Explains why the hard part of trajectory collection is not storage, but deciding which traces deserve to enter the training set.",
    },
    badge: { zh: "数据治理", en: "Data Curation" },
    whenToRead: {
      zh: "适合在你已经理解 trajectory recorder 和 batch runner 后，再回来看清日志、调试数据与训练样本之间为什么必须有过滤边界。",
      en: "Best once trajectory recording and batch generation make sense, when you need to distinguish raw logs, debug traces, and curated training samples.",
    },
    relatedVersions: ["h10", "h19"],
    relatedDocSlugs: ["h10a-fallback-taxonomy", "h16a-runtime-route", "data-structures"],
  },
  "h08a-skill-injection-boundary": {
    slug: "h08a-skill-injection-boundary",
    kind: "mechanism",
    title: { zh: "Skill Injection Boundary", en: "Skill Injection Boundary" },
    summary: {
      zh: "解释为什么 skill 是任务级操作指南，而不是 system prompt、memory 或 plugin 的替代品。",
      en: "Explains why a skill is a task-scoped operating guide rather than a substitute for system prompt, memory, or plugins.",
    },
    badge: { zh: "注入边界", en: "Injection Boundary" },
    whenToRead: {
      zh: "适合在你已经理解 skill 用 user message 注入，但仍分不清它与 system prompt、memory、plugin 的关系时回看。",
      en: "Best once you know skills are injected as user messages but still need to separate them cleanly from system prompts, memory, and plugins.",
    },
    relatedVersions: ["h04", "h08", "h18"],
    relatedDocSlugs: ["h04a-prompt-caching", "glossary", "data-structures"],
  },
  "h09a-approval-pipeline": {
    slug: "h09a-approval-pipeline",
    kind: "mechanism",
    title: { zh: "Approval Pipeline", en: "Approval Pipeline" },
    summary: {
      zh: "解释为什么权限系统必须在 dispatch 前由 runtime 统一裁决，而不是散落在各个工具内部。",
      en: "Explains why permissions must be decided centrally by the runtime before dispatch, rather than scattered across individual tools.",
    },
    badge: { zh: "权限控制面", en: "Permission Control" },
    whenToRead: {
      zh: "适合在你已经理解危险操作检测规则，但还没看清为什么审批逻辑属于调度层而不属于工具实现时回看。",
      en: "Best once danger detection rules are clear but you still need to see why approval belongs to the dispatch layer rather than to tool implementations.",
    },
    relatedVersions: ["h03", "h09"],
    relatedDocSlugs: ["h03a-agent-level-tools", "glossary", "data-structures"],
  },
  "h10a-fallback-taxonomy": {
    slug: "h10a-fallback-taxonomy",
    kind: "mechanism",
    title: { zh: "Fallback Taxonomy", en: "Fallback Taxonomy" },
    summary: {
      zh: "解释为什么 retry、fallback、continuation 不是同一种补救动作，以及它们分别对应哪一层失败恢复。",
      en: "Explains why retry, fallback, and continuation are not the same recovery move, and which failure layer each one addresses.",
    },
    badge: { zh: "恢复分层", en: "Recovery Layers" },
    whenToRead: {
      zh: "适合在你已经知道常见错误码如何分类，但还没把 retry、provider 切换、loop continuation 三者的层级区别想清楚时回看。",
      en: "Best once common error classes are familiar but you still need to distinguish retry, provider switching, and loop continuation as separate recovery layers.",
    },
    relatedVersions: ["h10", "h16"],
    relatedDocSlugs: ["h09a-approval-pipeline", "glossary", "data-structures"],
  },
};

function firstBridgeDoc(slug: string, locale: Locale) {
  return ALL_DOCS.find((doc) => doc.slug === slug && doc.kind === "bridge" && doc.locale === locale);
}

function mergeLocalizedField(
  definition: Partial<Record<Locale, string>> | undefined,
  slug: string,
  key: "title" | "summary"
) {
  return {
    zh: definition?.zh ?? firstBridgeDoc(slug, "zh")?.[key],
    en: definition?.en ?? firstBridgeDoc(slug, "en")?.[key],
  } satisfies Partial<Record<Locale, string>>;
}

function buildBridgeDocMeta(slug: string): BridgeDocMeta {
  const definition = BRIDGE_DEFINITIONS[slug];
  const fallbackZh = firstBridgeDoc(slug, "zh");
  const fallbackEn = firstBridgeDoc(slug, "en");
  const kind = definition?.kind ?? "mechanism";

  return {
    slug,
    kind,
    title: mergeLocalizedField(definition?.title, slug, "title"),
    summary: mergeLocalizedField(definition?.summary, slug, "summary"),
    badge: definition?.badge ?? BRIDGE_KIND_LABELS[kind],
    whenToRead: definition?.whenToRead ?? {
      zh: fallbackZh?.summary ? `建议在阅读相关章节前后回看：${fallbackZh.summary}` : "适合在主线章节开始串起来后回看，帮助重新校准理解边界。",
      en: fallbackEn?.summary ? `Useful before or after the related chapters: ${fallbackEn.summary}` : "Best revisited once multiple chapters begin to connect and you need to recalibrate boundaries.",
    },
    relatedVersions: definition?.relatedVersions ?? [],
    relatedDocSlugs: definition?.relatedDocSlugs ?? [],
  };
}

const bridgeSlugs = Array.from(
  new Set([
    ...Object.keys(BRIDGE_DEFINITIONS),
    ...ALL_DOCS.filter((doc) => doc.kind === "bridge").map((doc) => doc.slug),
  ])
).sort();

export const BRIDGE_DOCS = Object.fromEntries(
  bridgeSlugs.map((slug) => [slug, buildBridgeDocMeta(slug)])
) as Record<string, BridgeDocMeta>;

export function getBridgeDocMeta(slug: string): BridgeDocMeta | null {
  return BRIDGE_DOCS[slug] ?? null;
}

export function getChaptersForBridgeDoc(slug: string): Version[] {
  return BRIDGE_DOCS[slug]?.relatedVersions ?? [];
}

export function getRelatedBridgeDocs(slug: string): BridgeDocMeta[] {
  const related = BRIDGE_DOCS[slug]?.relatedDocSlugs ?? [];
  return related.map((item) => BRIDGE_DOCS[item]).filter(Boolean);
}

export function getBridgeDocsForVersion(version: Version): BridgeDocMeta[] {
  return Object.values(BRIDGE_DOCS)
    .filter((doc) => doc.relatedVersions.includes(version))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}
