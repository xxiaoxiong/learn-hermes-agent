import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { listDocs } from "@/lib/docs-loader";
import { getBridgeDocMeta } from "@/lib/bridge-docs";

export function generateStaticParams() {
  return [{ locale: "zh" }, { locale: "en" }];
}

const COPY = {
  zh: {
    title: "Docs",
    subtitle: "集中查看架构总览、术语表、数据结构速查与章节文档。现在 bridge docs 已经按用途分组，适合在主线阅读中随时回跳校准。",
    chapter: "章节文档",
    overview: "总览 / 地图",
    reference: "术语 / 数据结构",
    mechanism: "机制补充",
    empty: "当前语言下还没有可展示的文档。",
    open: "打开文档",
  },
  en: {
    title: "Docs",
    subtitle: "Browse architecture overviews, glossary notes, data-structure references, and chapter docs. Bridge docs are now grouped by reading purpose so you can jump back for calibration anytime.",
    chapter: "Chapter docs",
    overview: "Overview / maps",
    reference: "Terms / data structures",
    mechanism: "Mechanism notes",
    empty: "No documents are available for this locale yet.",
    open: "Open doc",
  },
} as const;

export default async function DocsIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = locale === "zh" ? COPY.zh : COPY.en;
  const docs = listDocs(locale);

  const chapterDocs = docs.filter((doc) => doc.kind === "chapter");
  const bridgeDocs = docs.filter((doc) => doc.kind === "bridge");
  const overviewDocs = bridgeDocs.filter((doc) => getBridgeDocMeta(doc.slug)?.kind === "overview");
  const referenceDocs = bridgeDocs.filter((doc) => getBridgeDocMeta(doc.slug)?.kind === "reference");
  const mechanismDocs = bridgeDocs.filter((doc) => getBridgeDocMeta(doc.slug)?.kind === "mechanism");

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#080808]/85 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-6 py-3">
          <Link href={`/${locale}`} className="flex items-center gap-2 text-sm text-white/40 transition-colors hover:text-white/70">
            <span className="text-white/20">←</span>
            <div className="h-4 w-4 rounded bg-gradient-to-br from-indigo-500 to-purple-600" />
            <span className="hidden sm:inline">Learn Hermes Agent</span>
          </Link>
          <span className="text-sm font-medium text-white/60">{locale === "zh" ? "文档库" : "Docs"}</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-0.5 rounded-md border border-white/[0.06] p-0.5">
              <Link href={`/en/docs`} className={`rounded px-2 py-0.5 text-xs transition-all ${locale === "en" ? "bg-white/[0.08] text-white/80" : "text-white/30 hover:text-white/60"}`}>EN</Link>
              <Link href={`/zh/docs`} className={`rounded px-2 py-0.5 text-xs transition-all ${locale === "zh" ? "bg-white/[0.08] text-white/80" : "text-white/30 hover:text-white/60"}`}>中文</Link>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] px-6 py-10 lg:px-8">
        <div className="mx-auto w-full max-w-[1120px] space-y-8">
          <section className="rounded-[28px] border border-white/[0.06] bg-white/[0.02] p-6 md:p-8">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs text-white/45">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
              Markdown Library
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">{t.title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/50 md:text-base">{t.subtitle}</p>
          </section>

          {docs.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/[0.08] p-16 text-center text-white/40">
              {t.empty}
            </div>
          ) : (
            <div className="space-y-8">
              {overviewDocs.length > 0 && <DocSection title={t.overview} docs={overviewDocs} locale={locale} fallback={t.open} />}
              {referenceDocs.length > 0 && <DocSection title={t.reference} docs={referenceDocs} locale={locale} fallback={t.open} />}
              {mechanismDocs.length > 0 && <DocSection title={t.mechanism} docs={mechanismDocs} locale={locale} fallback={t.open} />}
              {chapterDocs.length > 0 && <DocSection title={t.chapter} docs={chapterDocs} locale={locale} fallback={t.open} />}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function DocSection({
  title,
  docs,
  locale,
  fallback,
}: {
  title: string;
  docs: Array<{ slug: string; title: string; summary: string }>;
  locale: string;
  fallback: string;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-2 w-2 rounded-full bg-indigo-400" />
        <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-white/35">{title}</h2>
        <div className="flex-1 border-t border-white/[0.06]" />
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {docs.map((doc) => (
          <Link
            key={doc.slug}
            href={`/${locale}/docs/${doc.slug}`}
            className="group rounded-[24px] border border-white/[0.06] bg-white/[0.02] p-5 transition-all hover:border-white/15 hover:bg-white/[0.04]"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full border border-white/[0.08] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">
                {doc.slug}
              </span>
              <span className="text-white/15 transition-colors group-hover:text-white/30">→</span>
            </div>
            <h3 className="mt-4 text-lg font-semibold leading-snug text-white/90 group-hover:text-white">{doc.title}</h3>
            <p className="mt-3 line-clamp-4 text-sm leading-7 text-white/45">{doc.summary || fallback}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
