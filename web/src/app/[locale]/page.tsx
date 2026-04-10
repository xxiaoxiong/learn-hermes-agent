import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LAYER_ORDER, LAYERS, VERSION_META } from "@/lib/constants";
import { ThemeToggle } from "@/components/ThemeToggle";

type LayerId = "core" | "hardening" | "runtime" | "platform";

const LAYER_CONFIG: Record<LayerId, {
  num: string;
  dotColor: string;
  labelColor: string;
  cardBorder: string;
  cardHoverBorder: string;
  badgeBg: string;
  badgeText: string;
  additionColor: string;
}> = {
  core: {
    num: "01",
    dotColor: "bg-blue-400",
    labelColor: "text-blue-400",
    cardBorder: "border-white/[0.06]",
    cardHoverBorder: "hover:border-blue-500/40",
    badgeBg: "bg-blue-500/10",
    badgeText: "text-blue-300",
    additionColor: "text-blue-300/70",
  },
  hardening: {
    num: "02",
    dotColor: "bg-amber-400",
    labelColor: "text-amber-400",
    cardBorder: "border-white/[0.06]",
    cardHoverBorder: "hover:border-amber-500/40",
    badgeBg: "bg-amber-500/10",
    badgeText: "text-amber-300",
    additionColor: "text-amber-300/70",
  },
  runtime: {
    num: "03",
    dotColor: "bg-emerald-400",
    labelColor: "text-emerald-400",
    cardBorder: "border-white/[0.06]",
    cardHoverBorder: "hover:border-emerald-500/40",
    badgeBg: "bg-emerald-500/10",
    badgeText: "text-emerald-300",
    additionColor: "text-emerald-300/70",
  },
  platform: {
    num: "04",
    dotColor: "bg-purple-400",
    labelColor: "text-purple-400",
    cardBorder: "border-white/[0.06]",
    cardHoverBorder: "hover:border-purple-500/40",
    badgeBg: "bg-purple-500/10",
    badgeText: "text-purple-300",
    additionColor: "text-purple-300/70",
  },
};

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      {/* ── Navbar ── */}
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#080808]/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-gradient-to-br from-indigo-500 to-purple-600" />
            <span className="text-sm font-semibold tracking-tight">Learn Hermes Agent</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Extra nav links */}
            <div className="hidden sm:flex items-center gap-1">
              <Link href={`/${locale}/timeline`} className="rounded-md px-2.5 py-1 text-xs text-white/35 hover:bg-white/5 hover:text-white/65 transition-all">时间线</Link>
              <Link href={`/${locale}/layers`} className="rounded-md px-2.5 py-1 text-xs text-white/35 hover:bg-white/5 hover:text-white/65 transition-all">分层视图</Link>
              <Link href={`/${locale}/compare`} className="rounded-md px-2.5 py-1 text-xs text-white/35 hover:bg-white/5 hover:text-white/65 transition-all">Compare</Link>
              <Link href={`/${locale}/docs`} className="rounded-md px-2.5 py-1 text-xs text-white/35 hover:bg-white/5 hover:text-white/65 transition-all">Docs</Link>
            </div>
            {/* Language switcher */}
            <div className="flex items-center gap-0.5 rounded-md border border-white/[0.06] p-0.5">
              <Link
                href="/en"
                className={`rounded px-2.5 py-1 text-xs transition-all ${
                  locale === "en"
                    ? "bg-white/[0.08] text-white/80"
                    : "text-white/30 hover:text-white/60"
                }`}
              >
                English
              </Link>
              <Link
                href="/zh"
                className={`rounded px-2.5 py-1 text-xs transition-all ${
                  locale === "zh"
                    ? "bg-white/[0.08] text-white/80"
                    : "text-white/30 hover:text-white/60"
                }`}
              >
                中文
              </Link>
            </div>
            <ThemeToggle />
            <a
              href="https://github.com/your-org/learn-hermes-agent"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md px-2.5 py-1 text-xs text-white/40 hover:bg-white/5 hover:text-white/70 transition-all"
            >
              GitHub
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden border-b border-white/[0.06] px-6 pb-16 pt-20 text-center">
        {/* Subtle radial gradient */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[500px] w-[800px] rounded-full bg-indigo-600/10 blur-[120px]" />
        </div>
        <div className="relative mx-auto max-w-3xl">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs text-white/50">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
            19 章 · 4 层 · Hermes Agent 原理剖析
          </div>

          {/* Title */}
          <h1 className="mb-5 text-5xl font-bold tracking-tight md:text-6xl">
            <span className="bg-gradient-to-br from-white via-white/90 to-white/50 bg-clip-text text-transparent">
              {t("home.title")}
            </span>
          </h1>

          <p className="mb-3 text-xl text-white/50 font-light leading-relaxed">
            {t("home.subtitle")}
          </p>
          <p className="mb-10 text-sm text-white/30">{t("home.description")}</p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href={`/${locale}/h01`}
              style={{ background: 'var(--text)', color: 'var(--bg)' }}
              className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition-all"
            >
              {t("home.startLearning")}
              <span style={{ opacity: 0.5 }}>→</span>
            </Link>
            <a
              href="https://github.com/your-org/learn-hermes-agent"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-5 py-2.5 text-sm font-semibold text-white/60 hover:border-white/30 hover:text-white/80 transition-all"
            >
              {t("home.viewSource")}
            </a>
          </div>

          {/* Layer indicators */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-white/30">
            {(["core", "hardening", "runtime", "platform"] as LayerId[]).map((id) => (
              <div key={id} className="flex items-center gap-1.5">
                <div className={`h-1.5 w-1.5 rounded-full ${LAYER_CONFIG[id].dotColor}`} />
                <span>{t(`layers.${id}`)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Chapter List ── */}
      <main className="mx-auto w-full max-w-[1400px] px-6 py-14">
        <div className="mx-auto w-full max-w-[1120px] space-y-14">
          {LAYER_ORDER.map((layerId) => {
          const lid = layerId as LayerId;
          const layer = LAYERS[layerId];
          const cfg = LAYER_CONFIG[lid];

          return (
            <section key={layerId}>
              {/* Layer header */}
              <div className="mb-5 flex items-center gap-3">
                <div className={`h-2 w-2 rounded-full ${cfg.dotColor}`} />
                <span className={`text-xs font-bold uppercase tracking-[0.15em] ${cfg.labelColor}`}>
                  Layer {cfg.num} — {t(`layers.${layerId}`)}
                </span>
                <div className="flex-1 border-t border-white/[0.06]" />
                <span className="text-xs text-white/20">{layer.versions.length} 章</span>
              </div>

              {/* Chapter cards */}
              <div className="grid gap-2 sm:grid-cols-2">
                {layer.versions.map((version) => {
                  const meta = VERSION_META[version];
                  return (
                    <Link
                      key={version}
                      href={`/${locale}/${version}`}
                      className={`group relative flex flex-col gap-2 rounded-xl border bg-white/[0.02] p-5 transition-all duration-200 ${cfg.cardBorder} ${cfg.cardHoverBorder} hover:bg-white/[0.04]`}
                    >
                      {/* Chapter ID + badge */}
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-medium text-white/25 tracking-wider">
                          {version.toUpperCase()}
                        </span>
                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${cfg.badgeBg} ${cfg.badgeText}`}>
                          {meta.sourceType === "teaching" ? "教学实现" : "真实源码"}
                        </span>
                      </div>

                      {/* Title */}
                      <div>
                        <h3 className="font-semibold text-white/90 group-hover:text-white transition-colors leading-snug">
                          {meta.title}
                        </h3>
                        <p className="mt-1 text-sm text-white/40 leading-relaxed">
                          {meta.subtitle}
                        </p>
                      </div>

                      {/* Core addition */}
                      <p className={`mt-auto font-mono text-xs ${cfg.additionColor}`}>
                        + {meta.coreAddition}
                      </p>

                      {/* Arrow */}
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/10 transition-all group-hover:right-3 group-hover:text-white/30">
                        →
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.06] px-6 py-8 text-center text-xs text-white/20">
        <p>Learn Hermes Agent · 从理解一个生产级 AI Agent 的 19 个核心机制</p>
      </footer>
    </div>
  );
}
