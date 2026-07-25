import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

const COPY = {
  zh: {
    eyebrow: "CURRENT ARCHITECTURE · VERIFIED 2026-07-24",
    title: "Hermes Agent v0.19.0 架构地图",
    intro: "这不是旧版页面的功能清单，而是当前 Hermes 如何把入口、Agent 内核、工具、状态、编排与可靠性串成一个生产闭环。",
    source: "官方架构文档",
    release: "v0.19.0 发布说明",
    back: "返回课程",
    start: "从新增架构开始",
    stats: [
      ["70+", "工具"],
      ["≈28", "Toolsets"],
      ["20", "平台适配器"],
      ["6", "Terminal 后端"],
      ["18+", "Providers"],
      ["24", "课程章节"],
    ],
    layers: [
      ["01 · ENTRY SURFACES", "CLI · TUI · Desktop · Gateway · ACP · API Server · Python Library", "所有入口只做协议与事件适配，最终进入同一 AIAgent。"],
      ["02 · ORCHESTRATION CORE", "AIAgent · Prompt · Provider · Tool Dispatch · Compression", "run_conversation() 统一编排模型、工具、重试、回调、压缩与持久化。"],
      ["03 · CAPABILITY PLANE", "70+ Tools · MCP · Skills · Plugins · Context Engines", "原生工具、MCP 与插件能力通过注册表和 check_fn 松耦合接入。"],
      ["04 · STATE & IDENTITY", "Profiles · SQLite/FTS5 · Memory · Sessions · Secrets", "HERMES_HOME 是身份边界；会话谱系、记忆、技能和凭证都可独立演进。"],
      ["05 · MULTI-AGENT OPS", "Delegation · Kanban · Cron · Worktrees · Worker Lanes", "任务图管理所有权和依赖，隔离 worker 并持久化可恢复状态。"],
      ["06 · RELIABILITY LOOP", "Smart Approval · Delivery Ledger · Transcripts · Redaction", "命令先经过安全控制面，最终结果先落盘再投递，崩溃后可以恢复。"],
    ],
    deltasTitle: "相对三个月前，架构真正改变了什么",
    deltas: [
      ["Agent → Agent System", "Profile routing、Kanban 与多端入口把单个对话循环升级为可隔离、可编排的系统。"],
      ["Approval prompt → Security plane", "智能复核只判断具体命令，user deny 不可绕过，Secrets 可来自 Bitwarden/1Password。"],
      ["Generate → Deliver", "final response 进入持久投递义务账本，只有平台 ack 后才真正完成。"],
      ["Opaque workers → Observable workers", "子 Agent 有实时 transcript，后台结果具备持久所有权和恢复路径。"],
      ["One UI → Shared event core", "Desktop、TUI、Gateway 与 ACP 共享事件和 Agent 内核，性能优化不再分叉语义。"],
    ],
  },
  en: {
    eyebrow: "CURRENT ARCHITECTURE · VERIFIED 2026-07-24",
    title: "Hermes Agent v0.19.0 Architecture Map",
    intro: "Not a feature checklist: this is how current Hermes connects surfaces, the agent core, capabilities, state, orchestration, and reliability into one production loop.",
    source: "Official architecture",
    release: "v0.19.0 release notes",
    back: "Back to course",
    start: "Start with the new architecture",
    stats: [["70+", "Tools"], ["≈28", "Toolsets"], ["20", "Platform adapters"], ["6", "Terminal backends"], ["18+", "Providers"], ["24", "Course chapters"]],
    layers: [
      ["01 · ENTRY SURFACES", "CLI · TUI · Desktop · Gateway · ACP · API Server · Python Library", "Every surface adapts protocols and events before entering the same AIAgent."],
      ["02 · ORCHESTRATION CORE", "AIAgent · Prompt · Provider · Tool Dispatch · Compression", "run_conversation() coordinates models, tools, retries, callbacks, compression, and persistence."],
      ["03 · CAPABILITY PLANE", "70+ Tools · MCP · Skills · Plugins · Context Engines", "Native, MCP, and plugin capabilities join through registries and check_fn gating."],
      ["04 · STATE & IDENTITY", "Profiles · SQLite/FTS5 · Memory · Sessions · Secrets", "HERMES_HOME is the identity boundary; lineage, memory, skills, and secrets evolve independently."],
      ["05 · MULTI-AGENT OPS", "Delegation · Kanban · Cron · Worktrees · Worker Lanes", "Task graphs govern ownership and dependencies while isolated workers persist recoverable state."],
      ["06 · RELIABILITY LOOP", "Smart Approval · Delivery Ledger · Transcripts · Redaction", "Commands cross a security plane; final results are persisted before delivery and survive crashes."],
    ],
    deltasTitle: "What actually changed in three months",
    deltas: [
      ["Agent → Agent system", "Profile routing, Kanban, and multiple surfaces turn a conversation loop into an isolated, orchestrated system."],
      ["Approval prompt → Security plane", "Smart review judges exact commands, user deny is non-bypassable, and secrets can come from Bitwarden or 1Password."],
      ["Generate → Deliver", "Final responses enter a durable obligation ledger and complete only after platform acknowledgement."],
      ["Opaque workers → Observable workers", "Subagents expose live transcripts and background results have durable ownership and recovery."],
      ["One UI → Shared event core", "Desktop, TUI, Gateway, and ACP share the agent/event core instead of drifting in behavior."],
    ],
  },
} as const;

export function generateStaticParams() {
  return [{ locale: "zh" }, { locale: "en" }];
}

export default async function LatestArchitecturePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const c = COPY[locale === "zh" ? "zh" : "en"];

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#080808]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between px-6 py-3">
          <Link href={`/${locale}`} className="text-sm font-semibold">Learn Hermes Agent</Link>
          <div className="flex items-center gap-3">
            <Link href={`/${locale === "zh" ? "en" : "zh"}/latest`} className="text-xs text-white/45 hover:text-white/80">{locale === "zh" ? "EN" : "中文"}</Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-white/[0.06] px-6 py-20">
          <div className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-rose-600/10 blur-[130px]" />
          <div className="relative mx-auto max-w-[1120px]">
            <p className="mb-5 font-mono text-xs tracking-[0.18em] text-rose-300">{c.eyebrow}</p>
            <h1 className="max-w-4xl text-4xl font-bold tracking-tight md:text-6xl">{c.title}</h1>
            <p className="mt-6 max-w-3xl text-lg leading-relaxed text-white/50">{c.intro}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="https://hermes-agent.nousresearch.com/docs/developer-guide/architecture/" target="_blank" rel="noreferrer" className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black">{c.source} ↗</a>
              <a href="https://github.com/NousResearch/hermes-agent/releases/tag/v2026.7.20" target="_blank" rel="noreferrer" className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/70">{c.release} ↗</a>
            </div>
            <div className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.08] md:grid-cols-6">
              {c.stats.map(([value, label]) => <div key={label} style={{ background: "var(--bg)" }} className="px-5 py-6"><div className="text-2xl font-semibold">{value}</div><div className="mt-1 text-xs text-white/35">{label}</div></div>)}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1120px] px-6 py-16">
          <div className="space-y-3">
            {c.layers.map(([id, components, detail], index) => (
              <div key={id} className="grid gap-5 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 md:grid-cols-[180px_1fr_1fr]">
                <div className={`font-mono text-xs tracking-[0.12em] ${index === c.layers.length - 1 ? "text-rose-300" : "text-white/35"}`}>{id}</div>
                <div className="font-medium text-white/85">{components}</div>
                <div className="text-sm leading-relaxed text-white/40">{detail}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-white/[0.06] bg-white/[0.015] px-6 py-16">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-8 text-2xl font-semibold">{c.deltasTitle}</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {c.deltas.map(([title, detail]) => <div key={title} style={{ background: "var(--bg)" }} className="rounded-xl border border-white/[0.07] p-5"><h3 className="text-sm font-semibold text-rose-200">{title}</h3><p className="mt-2 text-sm leading-relaxed text-white/40">{detail}</p></div>)}
            </div>
          </div>
        </section>

        <section className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-4 px-6 py-14">
          <Link href={`/${locale}`} className="text-sm text-white/45 hover:text-white/80">← {c.back}</Link>
          <Link href={`/${locale}/h20`} className="rounded-lg bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-400">{c.start} →</Link>
        </section>
      </main>
    </div>
  );
}
