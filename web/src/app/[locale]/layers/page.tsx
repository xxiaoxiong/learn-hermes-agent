import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LAYER_ORDER, LAYERS, VERSION_META, type Version } from "@/lib/constants";
import { ThemeToggle } from "@/components/ThemeToggle";

type LayerId = "core" | "hardening" | "runtime" | "platform";

const LAYER_CONFIG: Record<LayerId, {
  num: string;
  question: string;
  desc: string;
  dotColor: string;
  labelColor: string;
  cardBorder: string;
  cardHoverBorder: string;
  badgeBg: string;
  badgeText: string;
  glowColor: string;
  lineColor: string;
}> = {
  core: {
    num: "01",
    question: "一个 agent 能做到什么最低限度？",
    desc: "消息循环、工具系统、任务规划、Prompt 组装、上下文压缩、会话存储——这 6 个机制是所有 agent 的共同基础。",
    dotColor: "bg-blue-400",
    labelColor: "text-blue-400",
    cardBorder: "border-white/[0.06]",
    cardHoverBorder: "hover:border-blue-500/40",
    badgeBg: "bg-blue-500/10",
    badgeText: "text-blue-300",
    glowColor: "bg-blue-600/8",
    lineColor: "border-blue-500/20",
  },
  hardening: {
    num: "02",
    question: "一个 agent 如何可靠工作？",
    desc: "记忆系统、Skills、权限控制、错误恢复、CLI 架构——生产环境中必须解决的 5 个稳定性问题。",
    dotColor: "bg-amber-400",
    labelColor: "text-amber-400",
    cardBorder: "border-white/[0.06]",
    cardHoverBorder: "hover:border-amber-500/40",
    badgeBg: "bg-amber-500/10",
    badgeText: "text-amber-300",
    glowColor: "bg-amber-600/8",
    lineColor: "border-amber-500/20",
  },
  runtime: {
    num: "03",
    question: "一个 agent 如何服务多个平台？",
    desc: "Gateway 多平台接入、Cron 定时任务、Hook 扩展机制、子 Agent 委托——让 agent 走出 CLI 的 4 个能力。",
    dotColor: "bg-emerald-400",
    labelColor: "text-emerald-400",
    cardBorder: "border-white/[0.06]",
    cardHoverBorder: "hover:border-emerald-500/40",
    badgeBg: "bg-emerald-500/10",
    badgeText: "text-emerald-300",
    glowColor: "bg-emerald-600/8",
    lineColor: "border-emerald-500/20",
  },
  platform: {
    num: "04",
    question: "一个 agent 如何成为可扩展平台？",
    desc: "Provider Runtime、MCP 工具集成、插件系统、RL 轨迹生成——让 Hermes 成为可扩展的 agent 平台的 4 个机制。",
    dotColor: "bg-purple-400",
    labelColor: "text-purple-400",
    cardBorder: "border-white/[0.06]",
    cardHoverBorder: "hover:border-purple-500/40",
    badgeBg: "bg-purple-500/10",
    badgeText: "text-purple-300",
    glowColor: "bg-purple-600/8",
    lineColor: "border-purple-500/20",
  },
};

export function generateStaticParams() {
  return [{ locale: "zh" }, { locale: "en" }];
}

export default async function LayersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      {/* ── Navbar ── */}
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#080808]/85 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-6 py-3">
          <Link
            href={`/${locale}`}
            className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors"
          >
            <span className="text-white/20">←</span>
            <div className="h-4 w-4 rounded bg-gradient-to-br from-indigo-500 to-purple-600" />
            <span className="hidden sm:inline">Learn Hermes Agent</span>
          </Link>
          <span className="text-sm font-medium text-white/60">分层视图</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-0.5 rounded-md border border-white/[0.06] p-0.5">
              <Link href={`/en/layers`} className={`rounded px-2 py-0.5 text-xs transition-all ${locale === "en" ? "bg-white/[0.08] text-white/80" : "text-white/30 hover:text-white/60"}`}>EN</Link>
              <Link href={`/zh/layers`} className={`rounded px-2 py-0.5 text-xs transition-all ${locale === "zh" ? "bg-white/[0.08] text-white/80" : "text-white/30 hover:text-white/60"}`}>中文</Link>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="border-b border-white/[0.06] px-6 py-12 text-center">
        <div className="mx-auto max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs text-white/40">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
            4 层架构 · 19 个机制
          </div>
          <h1 className="mb-3 text-3xl font-bold tracking-tight text-white">四层分层视图</h1>
          <p className="text-white/40">Hermes 的 19 个机制按"能做什么"分为 4 层，每层回答一个核心问题</p>
        </div>
      </section>

      {/* ── Layers ── */}
      <main className="mx-auto w-full max-w-[1400px] px-6 py-12">
        <div className="mx-auto w-full max-w-[1120px] space-y-12">
          {LAYER_ORDER.map((layerId, layerIdx) => {
          const lid = layerId as LayerId;
          const layer = LAYERS[layerId];
          const cfg = LAYER_CONFIG[lid];

          return (
            <section key={layerId} className="relative">
              {/* Layer header */}
              <div className={`relative overflow-hidden rounded-2xl border ${cfg.lineColor} bg-white/[0.015] p-6 mb-4`}>
                <div className={`pointer-events-none absolute right-0 top-0 h-full w-64 ${cfg.glowColor} blur-[80px]`} />
                <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${cfg.dotColor}`} />
                      <span className={`text-xs font-bold uppercase tracking-[0.15em] ${cfg.labelColor}`}>
                        Layer {cfg.num}
                      </span>
                      <span className="text-xs text-white/20">·</span>
                      <span className="text-xs text-white/35">{layer.labelZh}</span>
                    </div>
                    <p className={`text-base font-semibold text-white/80 mb-2`}>{cfg.question}</p>
                    <p className="text-sm text-white/40 leading-relaxed max-w-xl">{cfg.desc}</p>
                  </div>
                  <div className="flex-shrink-0">
                    <span className={`inline-flex rounded-lg px-3 py-1.5 text-xs font-medium ${cfg.badgeBg} ${cfg.badgeText}`}>
                      {layer.versions.length} 章
                    </span>
                  </div>
                </div>
              </div>

              {/* Chapter cards */}
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {layer.versions.map((version: Version) => {
                  const meta = VERSION_META[version];
                  return (
                    <Link
                      key={version}
                      href={`/${locale}/${version}`}
                      className={`group relative flex flex-col gap-2 rounded-xl border bg-white/[0.02] p-5 transition-all duration-200 ${cfg.cardBorder} ${cfg.cardHoverBorder} hover:bg-white/[0.04]`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-medium text-white/20 tracking-wider">
                          {version.toUpperCase()}
                        </span>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${cfg.badgeBg} ${cfg.badgeText}`}>
                          {meta.sourceType === "teaching" ? "教学" : "源码"}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-white/85 group-hover:text-white transition-colors text-sm leading-snug">
                          {meta.title}
                        </h3>
                        <p className="mt-1 text-xs text-white/35 leading-relaxed line-clamp-2">
                          {meta.keyInsight}
                        </p>
                      </div>
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/10 transition-all group-hover:right-2.5 group-hover:text-white/25">→</span>
                    </Link>
                  );
                })}
              </div>

              {/* Connector to next layer */}
              {layerIdx < LAYER_ORDER.length - 1 && (
                <div className="mt-6 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-1 text-white/15">
                    <div className="h-6 w-px bg-white/[0.06]" />
                    <span className="text-[10px] uppercase tracking-widest">下一层</span>
                    <div className="h-6 w-px bg-white/[0.06]" />
                  </div>
                </div>
              )}
            </section>
          );
        })}
        </div>
      </main>
    </div>
  );
}
