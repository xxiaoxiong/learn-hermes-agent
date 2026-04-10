import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { VERSION_ORDER, VERSION_META, LAYERS, type Version } from "@/lib/constants";
import { ThemeToggle } from "@/components/ThemeToggle";

type LayerId = "core" | "hardening" | "runtime" | "platform";

const LAYER_DOT: Record<LayerId, string> = {
  core: "bg-blue-400",
  hardening: "bg-amber-400",
  runtime: "bg-emerald-400",
  platform: "bg-purple-400",
};

const LAYER_LINE: Record<LayerId, string> = {
  core: "bg-blue-500/30",
  hardening: "bg-amber-500/30",
  runtime: "bg-emerald-500/30",
  platform: "bg-purple-500/30",
};

const LAYER_BADGE: Record<LayerId, { bg: string; text: string }> = {
  core: { bg: "bg-blue-500/10", text: "text-blue-300" },
  hardening: { bg: "bg-amber-500/10", text: "text-amber-300" },
  runtime: { bg: "bg-emerald-500/10", text: "text-emerald-300" },
  platform: { bg: "bg-purple-500/10", text: "text-purple-300" },
};

export function generateStaticParams() {
  return [{ locale: "zh" }, { locale: "en" }];
}

export default async function TimelinePage({
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
          <span className="text-sm font-medium text-white/60">时间线</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-0.5 rounded-md border border-white/[0.06] p-0.5">
              <Link href={`/en/timeline`} className={`rounded px-2 py-0.5 text-xs transition-all ${locale === "en" ? "bg-white/[0.08] text-white/80" : "text-white/30 hover:text-white/60"}`}>EN</Link>
              <Link href={`/zh/timeline`} className={`rounded px-2 py-0.5 text-xs transition-all ${locale === "zh" ? "bg-white/[0.08] text-white/80" : "text-white/30 hover:text-white/60"}`}>中文</Link>
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
            19 章 · 4 层 · 顺序学习路径
          </div>
          <h1 className="mb-3 text-3xl font-bold tracking-tight text-white">学习时间线</h1>
          <p className="text-white/40">每章只引入一个新概念，循序渐进构建 Hermes Agent 的完整心智模型</p>
        </div>
      </section>

      {/* ── Timeline ── */}
      <main className="mx-auto w-full max-w-[1400px] px-6 py-12">
        <div className="mx-auto w-full max-w-[880px]">
          {/* Layer legend */}
        <div className="mb-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-white/30">
          {(["core", "hardening", "runtime", "platform"] as LayerId[]).map((id) => (
            <div key={id} className="flex items-center gap-1.5">
              <div className={`h-1.5 w-1.5 rounded-full ${LAYER_DOT[id]}`} />
              <span>{LAYERS[id].labelZh}</span>
            </div>
          ))}
        </div>

        {/* Timeline items */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[7px] top-3 bottom-3 w-px bg-white/[0.06]" />

          <div className="space-y-0">
            {VERSION_ORDER.map((version, idx) => {
              const meta = VERSION_META[version];
              const layerId = meta.layer as LayerId;
              const badge = LAYER_BADGE[layerId];
              const isLastInLayer =
                idx === VERSION_ORDER.length - 1 ||
                VERSION_META[VERSION_ORDER[idx + 1]].layer !== meta.layer;

              return (
                <div key={version}>
                  <Link
                    href={`/${locale}/${version}`}
                    className="group relative flex items-start gap-5 py-3 hover:bg-white/[0.02] rounded-xl px-2 -mx-2 transition-all"
                  >
                    {/* Dot */}
                    <div className="relative mt-1.5 flex-shrink-0">
                      <div className={`h-[15px] w-[15px] rounded-full border-2 border-[#080808] ${LAYER_DOT[layerId]} transition-all group-hover:scale-125`} />
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-[10px] text-white/25">{version.toUpperCase()}</span>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${badge.bg} ${badge.text}`}>
                          {meta.sourceType === "teaching" ? "教学实现" : "真实源码"}
                        </span>
                      </div>
                      <h3 className="font-medium text-white/80 group-hover:text-white transition-colors leading-snug">
                        {meta.title}
                      </h3>
                      <p className="mt-0.5 text-sm text-white/35 leading-relaxed line-clamp-1">
                        {meta.coreAddition}
                      </p>
                    </div>

                    {/* Arrow */}
                    <span className="mt-1.5 text-white/10 transition-all group-hover:text-white/30 flex-shrink-0">→</span>
                  </Link>

                  {/* Layer separator */}
                  {isLastInLayer && idx < VERSION_ORDER.length - 1 && (
                    <div className="my-4 ml-9 flex items-center gap-3">
                      <div className={`h-px flex-1 ${LAYER_LINE[VERSION_META[VERSION_ORDER[idx + 1]].layer as LayerId]}`} />
                      <span className="text-[10px] font-medium uppercase tracking-widest text-white/15">
                        Layer {["core", "hardening", "runtime", "platform"].indexOf(VERSION_META[VERSION_ORDER[idx + 1]].layer as LayerId) + 1}
                      </span>
                      <div className={`h-px flex-1 ${LAYER_LINE[VERSION_META[VERSION_ORDER[idx + 1]].layer as LayerId]}`} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 text-center">
          <p className="mb-3 text-sm text-white/40">从第一章开始</p>
          <Link
            href={`/${locale}/h01`}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-5 py-2.5 text-sm font-medium text-white/60 hover:border-white/30 hover:text-white/90 transition-all"
          >
            Agent Loop — H01 <span>→</span>
          </Link>
        </div>
        </div>
      </main>
    </div>
  );
}
