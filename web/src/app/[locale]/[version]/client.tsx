"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import type { Version, I18nStr } from "@/lib/constants";
import { ARCH_BLUEPRINTS, type SliceId } from "@/data/architecture-blueprints";
import { EXECUTION_FLOWS } from "@/data/execution-flows";
import { DESIGN_DECISIONS } from "@/lib/design-decisions";
import type { BridgeDocMeta } from "@/lib/bridge-docs";
import { ExecutionFlowStepper } from "@/components/visualizations/ExecutionFlowStepper";

type Tab = "learn" | "code" | "deepdive";

interface Props {
  version: Version;
  sourceHtml: string;
  sourceFileName: string;
  docHtml: string | null;
  hermesSource: string[];
  guide: {
    focus: I18nStr;
    confusion: I18nStr;
    goal: I18nStr;
  };
  locale: string;
  bridgeDocs: BridgeDocMeta[];
}

export function ChapterClient({
  version,
  sourceHtml,
  sourceFileName,
  docHtml,
  hermesSource,
  guide,
  locale: localeProp,
  bridgeDocs,
}: Props) {
  const [tab, setTab] = useState<Tab>(docHtml ? "learn" : "code");
  const t = useTranslations();

  const tabs: { id: Tab; labelKey: string }[] = [
    { id: "learn", labelKey: "chapter.learnTab" },
    { id: "code", labelKey: "chapter.codeTab" },
    { id: "deepdive", labelKey: "chapter.deepDiveTab" },
  ];

  return (
    <div>
      {/* ── Tab bar ── */}
      <div className="flex items-center gap-0 border-b border-white/[0.06]">
        {tabs.map(({ id, labelKey }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-5 py-3 text-sm font-medium transition-all border-b-2 -mb-px ${
              tab === id
                ? "border-indigo-500 text-white"
                : "border-transparent text-white/35 hover:text-white/65 hover:border-white/20"
            }`}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      {/* ── Learn tab ── */}
      {tab === "learn" && (
        <div className="pt-8">
          {docHtml ? (
            <article
              className="max-w-none
                [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-white [&_h1]:mb-4 [&_h1]:mt-0
                [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-white [&_h2]:mt-10 [&_h2]:mb-4 [&_h2]:pb-2 [&_h2]:border-b [&_h2]:border-white/[0.06]
                [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-white/90 [&_h3]:mt-7 [&_h3]:mb-3
                [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:text-white/80 [&_h4]:mt-5 [&_h4]:mb-2
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
              dangerouslySetInnerHTML={{ __html: docHtml }}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-white/[0.08] p-14 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                <span className="text-xl">📝</span>
              </div>
              <p className="text-sm text-white/30">{t("chapter.docPlaceholder")}</p>
              <p className="mt-1.5 font-mono text-xs text-white/15">
                docs/{version}.md
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Code tab ── */}
      {tab === "code" && (
        <div className="pt-6">
          <div className="mb-3 flex items-center gap-3">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="font-mono text-xs text-white/35">{sourceFileName}</span>
          </div>
          <div
            className="overflow-auto rounded-xl border border-white/[0.06] text-xs leading-relaxed
              [&_pre]:m-0 [&_pre]:rounded-xl [&_pre]:!bg-[#0d1117] [&_pre]:p-6
              [&_.line]:min-h-[1.4em]"
            dangerouslySetInnerHTML={{ __html: sourceHtml }}
          />
        </div>
      )}

      {/* ── Deep Dive tab ── */}
      {tab === "deepdive" && (
        <div className="pt-6 space-y-5">
          {/* Guide cards: Focus / Confusion / Goal */}
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-blue-500/15 bg-blue-500/[0.04] p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-base">🎯</span>
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-blue-400">
                  {t("chapter.focus")}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-white/65">{localeProp === "zh" ? guide.focus.zh : guide.focus.en}</p>
            </div>
            <div className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.04] p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-base">⚡</span>
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-amber-400">
                  {t("chapter.confusion")}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-white/65">{localeProp === "zh" ? guide.confusion.zh : guide.confusion.en}</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-base">✓</span>
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-400">
                  {t("chapter.goal")}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-white/65">{localeProp === "zh" ? guide.goal.zh : guide.goal.en}</p>
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
              {hermesSource.map((src) => (
                <span
                  key={src}
                  className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 font-mono text-xs text-white/50"
                >
                  {src}
                </span>
              ))}
            </div>
          </div>

          {/* Architecture Blueprint */}
          <ArchBlueprint version={version} />

          {/* Execution flow (interactive stepper) */}
          <ExecutionFlowStepper version={version} />

          {/* Design decisions */}
          <DesignDecisionsPanel version={version} />

          {/* Bridge docs */}
          <BridgeDocsPanel version={version} bridgeDocs={bridgeDocs} />
        </div>
      )}
    </div>
  );
}

/* ─── Architecture Blueprint sub-component ─────────────────── */

const SLICE_STYLE: Record<SliceId, { dot: string; badge: string; border: string; bg: string; label: { zh: string; en: string } }> = {
  mainline: { dot: "bg-blue-500",    badge: "text-blue-400",    border: "border-blue-500/20",    bg: "bg-blue-500/[0.05]",    label: { zh: "主线执行",       en: "Mainline" } },
  control:  { dot: "bg-emerald-500", badge: "text-emerald-400", border: "border-emerald-500/20", bg: "bg-emerald-500/[0.05]", label: { zh: "控制面",         en: "Control Plane" } },
  state:    { dot: "bg-amber-500",   badge: "text-amber-400",   border: "border-amber-500/20",   bg: "bg-amber-500/[0.05]",   label: { zh: "状态容器",       en: "State Records" } },
  lanes:    { dot: "bg-rose-500",    badge: "text-rose-400",    border: "border-rose-500/20",    bg: "bg-rose-500/[0.05]",    label: { zh: "并行 / 外部车道", en: "Lanes / External" } },
};

const SLICE_ORDER: SliceId[] = ["mainline", "control", "state", "lanes"];

function ArchBlueprint({ version }: { version: Version }) {
  const locale = useLocale();
  const t = useTranslations();
  const blueprint = ARCH_BLUEPRINTS[version];
  if (!blueprint) return null;

  const visibleSlices = SLICE_ORDER.filter((s) => (blueprint.slices[s] ?? []).length > 0);
  const pick = (s: { zh: string; en: string }) => locale === "zh" ? s.zh : s.en;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="mb-2 flex items-center gap-2">
          <div className="h-1 w-4 rounded-full bg-indigo-400/60" />
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/25">
            {t("chapter.whatsNew")}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-white/70">{pick(blueprint.summary)}</p>
      </div>

      {/* Architecture slices */}
      {visibleSlices.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {visibleSlices.map((sliceId) => {
            const items = blueprint.slices[sliceId] ?? [];
            const style = SLICE_STYLE[sliceId];
            return (
              <div key={sliceId} className={`rounded-2xl border ${style.border} ${style.bg} p-4`}>
                <div className="mb-3 flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${style.dot}`} />
                  <span className={`text-[10px] font-bold uppercase tracking-[0.15em] ${style.badge}`}>
                    {pick(style.label)}
                  </span>
                </div>
                <div className="space-y-2.5">
                  {items.map((item, i) => (
                    <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                      <div className="flex items-start gap-2">
                        <span className="font-mono text-xs font-semibold text-white/80">{pick(item.name)}</span>
                        {item.fresh && (
                          <span className="rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/40">
                            {t("chapter.newTag")}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs leading-5 text-white/50">{pick(item.detail)}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Handoff steps */}
      {blueprint.handoff.length > 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="mb-4 flex items-center gap-2">
            <div className="h-1 w-4 rounded-full bg-white/20" />
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/25">
              {t("chapter.handoffPath")}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {blueprint.handoff.map((step, i) => (
              <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="flex items-start gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[11px] font-bold text-white/50">
                    {i + 1}
                  </span>
                  <p className="text-xs leading-5 text-white/60">{pick(step)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ExecutionFlowPanel({ version }: { version: Version }) {
  const locale = useLocale();
  const t = useTranslations();
  const flow = EXECUTION_FLOWS[version];
  if (!flow) return null;

  const pick = (s: { zh: string; en: string }) => locale === "zh" ? s.zh : s.en;
  const laneStyle: Record<string, string> = {
    input: "border-sky-500/20 bg-sky-500/[0.05] text-sky-300",
    decision: "border-violet-500/20 bg-violet-500/[0.05] text-violet-300",
    action: "border-emerald-500/20 bg-emerald-500/[0.05] text-emerald-300",
    state: "border-amber-500/20 bg-amber-500/[0.05] text-amber-300",
  };
  const laneLabel: Record<string, { zh: string; en: string }> = {
    input: { zh: "输入", en: "Input" },
    decision: { zh: "判断", en: "Decision" },
    action: { zh: "动作", en: "Action" },
    state: { zh: "状态", en: "State" },
  };

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
      <div className="mb-4 flex items-center gap-2">
        <div className="h-1 w-4 rounded-full bg-cyan-400/70" />
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/25">
          {t("chapter.executionFlow")}
        </span>
      </div>
      <p className="mb-5 text-sm leading-relaxed text-white/65">{pick(flow.summary)}</p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {flow.steps.map((item, idx) => (
          <div key={idx} className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.08] text-[11px] font-bold text-white/50">
                {idx + 1}
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.15em] ${laneStyle[item.lane]}`}>
                {locale === "zh" ? laneLabel[item.lane].zh : laneLabel[item.lane].en}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-white/85">{pick(item.title)}</h3>
            <p className="mt-2 text-xs leading-5 text-white/50">{pick(item.detail)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DesignDecisionsPanel({ version }: { version: Version }) {
  const locale = useLocale();
  const t = useTranslations();
  const items = DESIGN_DECISIONS[version] ?? [];
  if (items.length === 0) return null;

  const pick = (s: { zh: string; en: string }) => locale === "zh" ? s.zh : s.en;

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
      <div className="mb-4 flex items-center gap-2">
        <div className="h-1 w-4 rounded-full bg-fuchsia-400/70" />
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/25">
          {t("chapter.designDecisions")}
        </span>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {items.map((item, idx) => (
          <div key={idx} className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
            <h3 className="text-sm font-semibold text-white/88">{pick(item.title)}</h3>
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/25">{t("chapter.whyLabel")}</p>
                <p className="mt-1 text-xs leading-5 text-white/58">{pick(item.why)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/25">{t("chapter.tradeoffLabel")}</p>
                <p className="mt-1 text-xs leading-5 text-white/58">{pick(item.tradeoff)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BridgeDocsPanel({
  version,
  bridgeDocs,
}: {
  version: Version;
  bridgeDocs: BridgeDocMeta[];
}) {
  const locale = useLocale();
  const t = useTranslations();
  if (bridgeDocs.length === 0) return null;

  const pick = (value: Partial<Record<"zh" | "en", string>>) => value[locale as "zh" | "en"] ?? value.zh ?? value.en ?? "";

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-white/40">
        {t("chapter.bridgeDocs")}
      </h3>
      <p className="text-sm text-white/40">
        {t("chapter.bridgeDocsIntro")}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {bridgeDocs.map((doc) => (
          <Link
            key={doc.slug}
            href={`/${locale}/docs/${doc.slug}`}
            className="group rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 transition-colors hover:border-white/15 hover:bg-white/[0.04]"
          >
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium text-white/50">
                {pick(doc.badge)}
              </span>
            </div>
            <h4 className="mt-2 text-sm font-semibold text-white/85">{pick(doc.title)}</h4>
            <p className="mt-1 text-xs leading-5 text-white/40">{pick(doc.summary)}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
