import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { codeToHtml } from "shiki";
import { marked } from "marked";
import { VERSION_META, VERSION_ORDER, pick, type Version } from "@/lib/constants";
import { CHAPTER_GUIDES } from "@/lib/chapter-guides";
import { getBridgeDocsForVersion } from "@/lib/bridge-docs";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ChapterSidebar } from "@/components/ChapterSidebar";
import { getSourceCode, getSourceFileName, getDocMarkdown } from "@/lib/source-loader";
import { ChapterClient } from "./client";

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

  const sourceCode = getSourceCode(v);
  const sourceFileName = getSourceFileName(v);
  const bridgeDocs = getBridgeDocsForVersion(v);
  const sourceHtml = sourceCode
    ? await codeToHtml(sourceCode, { lang: "python", theme: "github-dark" })
    : `<pre style="padding:1.5rem;color:#555;background:#0d1117;border-radius:0.75rem">${locale === "zh" ? "源码文件暂未找到" : "Source file not found yet"}</pre>`;

  const markdown = getDocMarkdown(v, locale);
  const docHtml = markdown ? (marked.parse(markdown) as string) : null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#080808] text-white">

      {/* ── Navbar (full-width, fixed height) ── */}
      <header className="flex-none z-20 border-b border-white/[0.06] bg-[#080808]/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between px-5 py-3">
          {/* Left: home link */}
          <Link
            href={`/${locale}`}
            className="flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition-colors"
          >
            {/* <div className="h-5 w-5 rounded bg-gradient-to-br from-indigo-500 to-purple-600" /> */}
            <span className="text-lg font-semibold tracking-tight">Learn Hermes Agent</span>
          </Link>

          {/* Center: current chapter badge */}
          <div className="flex items-center gap-2">
            <span className={`rounded-md px-2.5 py-1 font-mono text-xs font-medium ${theme.badgeBg} ${theme.badgeText}`}>
              {v.toUpperCase()}
            </span>
            <span className="hidden sm:inline text-sm text-white/50">{pick(meta.title, locale)}</span>
            <span className="text-xs text-white/20">{chapterNum}/{VERSION_ORDER.length}</span>
          </div>

          {/* Right: locale + theme */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-md border border-white/[0.06] p-0.5">
              <Link
                href={`/en/${v}`}
                className={`rounded px-2 py-0.5 text-xs transition-all ${
                  locale === "en"
                    ? "bg-white/[0.08] text-white/80"
                    : "text-white/30 hover:text-white/60"
                }`}
              >
                EN
              </Link>
              <Link
                href={`/zh/${v}`}
                className={`rounded px-2 py-0.5 text-xs transition-all ${
                  locale === "zh"
                    ? "bg-white/[0.08] text-white/80"
                    : "text-white/30 hover:text-white/60"
                }`}
              >
                中文
              </Link>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* ── Body: sidebar + scrollable main ── */}
      <div className="mx-auto flex w-full max-w-[1500px] flex-1 overflow-hidden">

        {/* ── Left Sidebar ── */}
        <aside className="flex-none w-[218px] overflow-y-auto border-r border-white/[0.06]">
          <ChapterSidebar currentVersion={v} locale={locale} />
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1180px]">
            {/* Hero */}
          <section className="relative overflow-hidden border-b border-white/[0.06] px-8 py-12">
            <div className="pointer-events-none absolute left-0 top-0 h-full w-1/2">
              <div className={`h-full w-full ${theme.glowColor} blur-[100px]`} />
            </div>
            <div className="relative max-w-3xl">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${theme.badgeBg} ${theme.badgeText}`}>
                  <div className={`h-1.5 w-1.5 rounded-full ${theme.dotColor}`} />
                  {t(`layers.${layerId}`)}
                </div>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/40">
                  {meta.sourceType === "teaching" ? t("chapter.teachingImpl") : t("chapter.realSource")}
                </span>
              </div>
              <h1 className="mb-2 text-3xl font-bold tracking-tight md:text-4xl">
                <span className="bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent">
                  {pick(meta.title, locale)}
                </span>
              </h1>
              <p className="text-base text-white/40 leading-relaxed">{pick(meta.subtitle, locale)}</p>
            </div>
          </section>

          {/* Content area */}
          <div className="px-8 py-8 space-y-5 max-w-3xl">

            {/* Core Addition + Key Insight */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1 w-4 rounded-full bg-emerald-400" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">
                    {t("chapter.coreAddition")}
                  </span>
                </div>
                <p className="font-mono text-sm leading-relaxed text-emerald-300">+ {pick(meta.coreAddition, locale)}</p>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1 w-4 rounded-full bg-indigo-400" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">
                    {t("chapter.keyInsight")}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-white/75">{pick(meta.keyInsight, locale)}</p>
              </div>
            </div>

            {/* Three-tab content */}
            <ChapterClient
              version={v}
              sourceHtml={sourceHtml}
              sourceFileName={sourceFileName}
              docHtml={docHtml}
              hermesSource={meta.hermesSource}
              guide={guide}
              locale={locale}
              bridgeDocs={bridgeDocs}
            />

            {/* Bottom prev/next navigation */}
            <div className="flex items-center justify-between border-t border-white/[0.06] pt-5">
              {prevVersion ? (
                <Link
                  href={`/${locale}/${prevVersion}`}
                  className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-sm hover:border-white/15 hover:bg-white/[0.04] transition-all"
                >
                  <span className="text-white/30 group-hover:text-white/60 transition-colors">←</span>
                  <div>
                    <div className="text-[11px] text-white/25">{t("chapter.prev")}</div>
                    <div className="text-sm font-medium text-white/65 group-hover:text-white/90">{pick(VERSION_META[prevVersion].title, locale)}</div>
                  </div>
                </Link>
              ) : <div />}
              {nextVersion ? (
                <Link
                  href={`/${locale}/${nextVersion}`}
                  className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-sm hover:border-white/15 hover:bg-white/[0.04] transition-all text-right"
                >
                  <div>
                    <div className="text-[11px] text-white/25">{t("chapter.next")}</div>
                    <div className="text-sm font-medium text-white/65 group-hover:text-white/90">{pick(VERSION_META[nextVersion].title, locale)}</div>
                  </div>
                  <span className="text-white/30 group-hover:text-white/60 transition-colors">→</span>
                </Link>
              ) : <div />}
            </div>
          </div>
          </div>
        </main>
      </div>
    </div>
  );
}
