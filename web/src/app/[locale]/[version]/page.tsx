import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { VERSION_META, VERSION_ORDER, type Version } from "@/lib/constants";
import { CHAPTER_GUIDES } from "@/lib/chapter-guides";

export function generateStaticParams() {
  const locales = ["zh", "en"];
  return locales.flatMap((locale) =>
    VERSION_ORDER.map((version) => ({ locale, version }))
  );
}

type LayerId = "core" | "hardening" | "runtime" | "platform";

const LAYER_THEME: Record<LayerId, {
  gradientFrom: string;
  gradientTo: string;
  dotColor: string;
  labelColor: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  glowColor: string;
}> = {
  core: {
    gradientFrom: "from-blue-600/20",
    gradientTo: "to-transparent",
    dotColor: "bg-blue-400",
    labelColor: "text-blue-400",
    badgeBg: "bg-blue-500/15",
    badgeText: "text-blue-300",
    borderColor: "border-blue-500/20",
    glowColor: "bg-blue-600/10",
  },
  hardening: {
    gradientFrom: "from-amber-600/20",
    gradientTo: "to-transparent",
    dotColor: "bg-amber-400",
    labelColor: "text-amber-400",
    badgeBg: "bg-amber-500/15",
    badgeText: "text-amber-300",
    borderColor: "border-amber-500/20",
    glowColor: "bg-amber-600/10",
  },
  runtime: {
    gradientFrom: "from-emerald-600/20",
    gradientTo: "to-transparent",
    dotColor: "bg-emerald-400",
    labelColor: "text-emerald-400",
    badgeBg: "bg-emerald-500/15",
    badgeText: "text-emerald-300",
    borderColor: "border-emerald-500/20",
    glowColor: "bg-emerald-600/10",
  },
  platform: {
    gradientFrom: "from-purple-600/20",
    gradientTo: "to-transparent",
    dotColor: "bg-purple-400",
    labelColor: "text-purple-400",
    badgeBg: "bg-purple-500/15",
    badgeText: "text-purple-300",
    borderColor: "border-purple-500/20",
    glowColor: "bg-purple-600/10",
  },
};

export default async function VersionPage({
  params,
}: {
  params: Promise<{ locale: string; version: string }>;
}) {
  const { locale, version } = await params;

  if (!VERSION_ORDER.includes(version as Version)) {
    notFound();
  }

  const v = version as Version;
  const meta = VERSION_META[v];
  const guide = CHAPTER_GUIDES[v];
  const t = await getTranslations({ locale });

  const currentIdx = VERSION_ORDER.indexOf(v);
  const prevVersion = currentIdx > 0 ? VERSION_ORDER[currentIdx - 1] : null;
  const nextVersion = currentIdx < VERSION_ORDER.length - 1 ? VERSION_ORDER[currentIdx + 1] : null;

  const layerId = meta.layer as LayerId;
  const theme = LAYER_THEME[layerId];
  const chapterNum = currentIdx + 1;

  return (
    <div className="min-h-screen bg-[#080808] text-white">

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#080808]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          {/* Left: home link */}
          <Link
            href={`/${locale}`}
            className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors"
          >
            <span className="text-white/20">←</span>
            <div className="h-4 w-4 rounded bg-gradient-to-br from-indigo-500 to-purple-600" />
            <span className="hidden sm:inline">Learn Hermes Agent</span>
          </Link>

          {/* Center: chapter navigation */}
          <div className="flex items-center gap-1">
            {prevVersion ? (
              <Link
                href={`/${locale}/${prevVersion}`}
                className="flex items-center gap-1 rounded-md px-3 py-1.5 text-xs text-white/30 hover:bg-white/5 hover:text-white/60 transition-all"
              >
                <span>←</span>
                <span className="font-mono">{prevVersion.toUpperCase()}</span>
              </Link>
            ) : (
              <div className="w-16" />
            )}
            <span className={`rounded-md px-3 py-1 font-mono text-xs font-medium ${theme.badgeBg} ${theme.badgeText}`}>
              {v.toUpperCase()}
            </span>
            {nextVersion ? (
              <Link
                href={`/${locale}/${nextVersion}`}
                className="flex items-center gap-1 rounded-md px-3 py-1.5 text-xs text-white/30 hover:bg-white/5 hover:text-white/60 transition-all"
              >
                <span className="font-mono">{nextVersion.toUpperCase()}</span>
                <span>→</span>
              </Link>
            ) : (
              <div className="w-16" />
            )}
          </div>

          {/* Right: locale + progress */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/20">{chapterNum} / {VERSION_ORDER.length}</span>
            <Link
              href={locale === "zh" ? `/en/${v}` : `/zh/${v}`}
              className="rounded-md px-2 py-1 text-xs text-white/30 hover:bg-white/5 hover:text-white/50 transition-all"
            >
              {locale === "zh" ? "EN" : "中文"}
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden border-b border-white/[0.06] px-6 py-14">
        {/* Layer-colored ambient glow */}
        <div className="pointer-events-none absolute left-0 top-0 h-full w-1/2">
          <div className={`h-full w-full ${theme.glowColor} blur-[100px]`} />
        </div>

        <div className="relative mx-auto max-w-4xl">
          {/* Layer + source type badges */}
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${theme.badgeBg} ${theme.badgeText}`}>
              <div className={`h-1.5 w-1.5 rounded-full ${theme.dotColor}`} />
              {t(`layers.${layerId}`)}
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/40">
              {meta.sourceType === "teaching" ? t("chapter.teachingImpl") : t("chapter.realSource")}
            </span>
          </div>

          {/* Chapter title */}
          <h1 className="mb-3 text-4xl font-bold tracking-tight md:text-5xl">
            <span className="bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent">
              {meta.title}
            </span>
          </h1>
          <p className="text-lg text-white/40 leading-relaxed max-w-2xl">{meta.subtitle}</p>
        </div>
      </section>

      {/* ── Content ── */}
      <div className="mx-auto max-w-4xl px-6 py-10 space-y-6">

        {/* Core Addition + Key Insight */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Core Addition */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
            <div className="mb-3 flex items-center gap-2">
              <div className="h-1 w-4 rounded-full bg-emerald-400" />
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">
                {t("chapter.coreAddition")}
              </span>
            </div>
            <p className="font-mono text-sm leading-relaxed text-emerald-300">
              + {meta.coreAddition}
            </p>
          </div>

          {/* Key Insight */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
            <div className="mb-3 flex items-center gap-2">
              <div className="h-1 w-4 rounded-full bg-indigo-400" />
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">
                {t("chapter.keyInsight")}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-white/75">{meta.keyInsight}</p>
          </div>
        </div>

        {/* Guide cards: Focus / Confusion / Goal */}
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-blue-500/15 bg-blue-500/[0.04] p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-base">🎯</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-blue-400">
                {t("chapter.focus")}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-white/65">{guide.focus}</p>
          </div>
          <div className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.04] p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-base">⚡</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-amber-400">
                {t("chapter.confusion")}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-white/65">{guide.confusion}</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-base">✓</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-400">
                {t("chapter.goal")}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-white/65">{guide.goal}</p>
          </div>
        </div>

        {/* Hermes Source reference */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="h-1 w-4 rounded-full bg-white/20" />
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/25">
              {t("chapter.hermesSource")}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {meta.hermesSource.map((src) => (
              <span
                key={src}
                className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 font-mono text-xs text-white/50"
              >
                {src}
              </span>
            ))}
          </div>
        </div>

        {/* Content placeholder */}
        <div className="rounded-2xl border border-dashed border-white/[0.08] p-12 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
            <span className="text-lg">📄</span>
          </div>
          <p className="text-sm text-white/25">文档内容区 — Phase 4 文档编写后填充</p>
          <p className="mt-1 font-mono text-xs text-white/15">docs/zh/{v}.md</p>
        </div>

        {/* Bottom chapter navigation */}
        <div className="flex items-center justify-between border-t border-white/[0.06] pt-6">
          {prevVersion ? (
            <Link
              href={`/${locale}/${prevVersion}`}
              className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-3 text-sm hover:border-white/15 hover:bg-white/[0.04] transition-all"
            >
              <span className="text-white/30 group-hover:text-white/60 transition-colors">←</span>
              <div>
                <div className="text-xs text-white/30">上一章</div>
                <div className="font-medium text-white/70 group-hover:text-white/90">{VERSION_META[prevVersion].title}</div>
              </div>
            </Link>
          ) : <div />}

          {nextVersion ? (
            <Link
              href={`/${locale}/${nextVersion}`}
              className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-3 text-sm hover:border-white/15 hover:bg-white/[0.04] transition-all text-right"
            >
              <div>
                <div className="text-xs text-white/30">下一章</div>
                <div className="font-medium text-white/70 group-hover:text-white/90">{VERSION_META[nextVersion].title}</div>
              </div>
              <span className="text-white/30 group-hover:text-white/60 transition-colors">→</span>
            </Link>
          ) : <div />}
        </div>
      </div>
    </div>
  );
}
