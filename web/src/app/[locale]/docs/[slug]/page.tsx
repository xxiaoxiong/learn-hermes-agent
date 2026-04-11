import Link from "next/link";
import { marked } from "marked";
import { ThemeToggle } from "@/components/ThemeToggle";
import { VERSION_META, pick, type Version } from "@/lib/constants";
import {
  getBridgeDocMeta,
  getChaptersForBridgeDoc,
  getRelatedBridgeDocs,
} from "@/lib/bridge-docs";
import { getDocBySlug, getDocMarkdownBySlug, listAvailableDocSlugs } from "@/lib/docs-loader";

export function generateStaticParams() {
  const locales = ["zh", "en"];
  const slugs = listAvailableDocSlugs();
  return locales.flatMap((locale) => slugs.map((slug) => ({ locale, slug })));
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const doc = getDocBySlug(slug, locale) ?? getDocBySlug(slug, "zh") ?? getDocBySlug(slug, "en");
  const markdown = getDocMarkdownBySlug(slug, locale);
  const html = markdown ? (marked.parse(markdown) as string) : null;
  const bridgeMeta = getBridgeDocMeta(slug);
  const relatedVersions = getChaptersForBridgeDoc(slug);
  const relatedBridgeDocs = getRelatedBridgeDocs(slug);
  const isBridgeDoc = doc?.kind === "bridge" || Boolean(bridgeMeta);
  const badgeLabel = bridgeMeta?.badge?.[locale as "zh" | "en"] ?? bridgeMeta?.badge?.zh ?? bridgeMeta?.badge?.en;
  const whenToRead = bridgeMeta?.whenToRead?.[locale as "zh" | "en"] ?? bridgeMeta?.whenToRead?.zh ?? bridgeMeta?.whenToRead?.en;

  const copy = locale === "zh"
    ? {
        docs: "Docs",
        standalone: "独立补充文档",
        chapterDoc: "章节文档",
        when: "什么时候该回看这页",
        chapters: "最适合搭配这些章节一起读",
        relatedDocs: "继续延伸阅读",
        open: "打开",
        missing: "Document not found.",
      }
    : {
        docs: "Docs",
        standalone: "Standalone Bridge Doc",
        chapterDoc: "Chapter Doc",
        when: "When this page helps",
        chapters: "Best read alongside",
        relatedDocs: "Keep exploring",
        open: "Open",
        missing: "Document not found.",
      };

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#080808]/85 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-6 py-3">
          <Link href={`/${locale}/docs`} className="flex items-center gap-2 text-sm text-white/40 transition-colors hover:text-white/70">
            <span className="text-white/20">←</span>
            <div className="h-4 w-4 rounded bg-gradient-to-br from-indigo-500 to-purple-600" />
            <span className="hidden sm:inline">{copy.docs}</span>
          </Link>
          <span className="truncate px-4 text-sm font-medium text-white/60">{doc?.title ?? slug}</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-0.5 rounded-md border border-white/[0.06] p-0.5">
              <Link href={`/en/docs/${slug}`} className={`rounded px-2 py-0.5 text-xs transition-all ${locale === "en" ? "bg-white/[0.08] text-white/80" : "text-white/30 hover:text-white/60"}`}>EN</Link>
              <Link href={`/zh/docs/${slug}`} className={`rounded px-2 py-0.5 text-xs transition-all ${locale === "zh" ? "bg-white/[0.08] text-white/80" : "text-white/30 hover:text-white/60"}`}>中文</Link>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] px-6 py-10 lg:px-8">
        <div className="mx-auto w-full max-w-[980px] space-y-6">
          <section className="rounded-[28px] border border-white/[0.06] bg-white/[0.02] p-6 md:p-8">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs text-white/45">
                <span className={`h-1.5 w-1.5 rounded-full ${isBridgeDoc ? "bg-indigo-400" : "bg-emerald-400"}`} />
                {badgeLabel ?? (isBridgeDoc ? copy.standalone : copy.chapterDoc)}
              </div>
              {doc?.locale && doc.locale !== locale ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/[0.06] px-4 py-1.5 text-xs text-amber-200/80">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                  {locale === "zh" ? `当前回退到 ${doc.locale.toUpperCase()} 文档` : `Showing ${doc.locale.toUpperCase()} fallback copy`}
                </div>
              ) : null}
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">{doc?.title ?? slug}</h1>
            {doc?.summary ? <p className="mt-3 text-sm leading-7 text-white/50 md:text-base">{doc.summary}</p> : null}
          </section>

          {isBridgeDoc && (whenToRead || relatedVersions.length > 0 || relatedBridgeDocs.length > 0) ? (
            <section className="rounded-[28px] border border-white/[0.06] bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.14),transparent_42%),rgba(255,255,255,0.02)] p-6 md:p-8">
              <div className="space-y-6">
                {whenToRead ? (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/30">{copy.when}</p>
                    <p className="mt-3 text-sm leading-7 text-white/68">{whenToRead}</p>
                  </div>
                ) : null}

                {relatedVersions.length > 0 ? (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/30">{copy.chapters}</p>
                    <div className="mt-3 flex flex-wrap gap-2.5">
                      {relatedVersions.map((version) => (
                        <Link
                          key={version}
                          href={`/${locale}/${version}`}
                          className="group rounded-full border border-white/[0.08] bg-white/[0.04] px-3.5 py-2 text-sm text-white/58 transition-all hover:border-white/16 hover:bg-white/[0.07] hover:text-white"
                        >
                          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/35 group-hover:text-white/50">{version}</span>
                          <span className="ml-2">{pick(VERSION_META[version].title, locale)}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}

                {relatedBridgeDocs.length > 0 ? (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/30">{copy.relatedDocs}</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {relatedBridgeDocs.map((related) => {
                        const relatedTitle = related.title[locale as "zh" | "en"] ?? related.title.zh ?? related.title.en ?? related.slug;
                        const relatedSummary = related.summary[locale as "zh" | "en"] ?? related.summary.zh ?? related.summary.en ?? "";
                        return (
                          <Link
                            key={related.slug}
                            href={`/${locale}/docs/${related.slug}`}
                            className="group rounded-[22px] border border-white/[0.06] bg-white/[0.03] p-4 transition-all hover:border-white/14 hover:bg-white/[0.05]"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="rounded-full border border-white/[0.08] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">
                                {related.slug}
                              </span>
                              <span className="text-white/18 transition-colors group-hover:text-white/35">↗</span>
                            </div>
                            <h3 className="mt-4 text-base font-semibold text-white/88 group-hover:text-white">{relatedTitle}</h3>
                            <p className="mt-2 text-sm leading-6 text-white/45">{relatedSummary}</p>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className="rounded-[28px] border border-white/[0.06] bg-white/[0.02] px-6 py-8 md:px-8">
            {html ? (
              <article
                className="max-w-none
                  [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-white [&_h1]:mb-4 [&_h1]:mt-0
                  [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-white [&_h2]:mt-10 [&_h2]:mb-4 [&_h2]:pb-2 [&_h2]:border-b [&_h2]:border-white/[0.06]
                  [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-white/90 [&_h3]:mt-7 [&_h3]:mb-3
                  [&_p]:text-white/65 [&_p]:leading-7 [&_p]:mb-4
                  [&_ul]:mb-4 [&_ul]:space-y-1.5 [&_ul]:pl-0 [&_ul>li]:text-white/65 [&_ul>li]:leading-6 [&_ul>li]:pl-4 [&_ul>li]:relative [&_ul>li]:before:content-['–'] [&_ul>li]:before:absolute [&_ul>li]:before:left-0 [&_ul>li]:before:text-white/25
                  [&_ol]:mb-4 [&_ol]:pl-6 [&_ol>li]:text-white/65 [&_ol>li]:leading-6 [&_ol>li]:mb-1
                  [&_strong]:text-white [&_strong]:font-semibold
                  [&_em]:text-white/75 [&_em]:italic
                  [&_code]:text-emerald-300 [&_code]:bg-white/[0.06] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[0.8em] [&_code]:font-mono
                  [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-white/[0.06] [&_pre]:bg-[#0d1117] [&_pre]:p-5 [&_pre]:overflow-auto [&_pre]:mb-5
                  [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-white/80 [&_pre_code]:text-xs [&_pre_code]:leading-relaxed
                  [&_blockquote]:border-l-2 [&_blockquote]:border-indigo-500/50 [&_blockquote]:pl-4 [&_blockquote]:ml-0 [&_blockquote]:text-white/45 [&_blockquote]:italic [&_blockquote]:mb-4
                  [&_hr]:border-white/[0.06] [&_hr]:my-8
                  [&_table]:w-full [&_table]:mb-5 [&_table]:border-collapse
                  [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:text-white/50 [&_th]:uppercase [&_th]:tracking-wider [&_th]:border-b [&_th]:border-white/[0.08] [&_th]:pb-2 [&_th]:pr-4
                  [&_td]:text-sm [&_td]:text-white/60 [&_td]:border-b [&_td]:border-white/[0.04] [&_td]:py-2 [&_td]:pr-4
                  [&_a]:text-indigo-400 [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-indigo-300"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            ) : (
              <div className="rounded-3xl border border-dashed border-white/[0.08] p-16 text-center text-white/40">
                {copy.missing}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
