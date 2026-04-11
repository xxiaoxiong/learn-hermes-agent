"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { VERSION_META, VERSION_ORDER, pick, type Version } from "@/lib/constants";

type LayerId = "core" | "hardening" | "runtime" | "platform";

const BADGE: Record<LayerId, string> = {
  core: "bg-blue-500/12 text-blue-300 border-blue-500/20",
  hardening: "bg-amber-500/12 text-amber-300 border-amber-500/20",
  runtime: "bg-emerald-500/12 text-emerald-300 border-emerald-500/20",
  platform: "bg-purple-500/12 text-purple-300 border-purple-500/20",
};

const PRESETS: { a: Version; b: Version }[] = [
  { a: "h01", b: "h02" },
  { a: "h06", b: "h07" },
  { a: "h11", b: "h12" },
  { a: "h15", b: "h16" },
  { a: "h18", b: "h19" },
];

const TEXT = {
  zh: {
    title: "章节 Compare",
    sub: "对比两章之间真正新增的系统能力，判断这是相邻升级、同层跳读还是跨层跃迁。",
    a: "章节 A",
    b: "章节 B",
    quick: "快速入口",
    distance: "章节距离",
    jump: "跃迁类型",
    mode: "实现形态",
    adjacent: "相邻章节",
    sameLayer: "同层跳读",
    crossLayer: "跨层跃迁",
    same: "同一章节",
    changed: "B 章新增了什么",
    add: "核心新增",
    insight: "关键洞察",
    source: "对应源码",
    hint: "阅读建议",
    next: "推荐下一步",
    prev: "先改成 B 的前一章 → B",
    open: "打开 B 章",
    noPrev: "B 已经是第一章。",
    modes: ["教学 → 教学", "教学 → 源码", "源码 → 教学", "源码 → 源码"],
    hints: {
      same: ["这是同章复习", "适合复盘结构，不适合观察新增能力。"],
      adjacent: ["这是最稳的一步升级", "优先看系统刚刚多出的一条分支、一个状态容器或一条新规则。"],
      sameLayer: ["这是同阶段内跳读", "中间章节通常负责拆开概念，建议先确认没有跳过关键过渡。"],
      crossLayer: ["这是跨阶段跃迁", "难点不是功能变多，而是系统边界已经重画了。先稳住上一层目标。"],
    },
  },
  en: {
    title: "Chapter Compare",
    sub: "Compare what system capability is actually added between two chapters, and decide whether this is an adjacent upgrade, same-layer skip, or cross-layer jump.",
    a: "Chapter A",
    b: "Chapter B",
    quick: "Quick presets",
    distance: "Distance",
    jump: "Jump type",
    mode: "Implementation",
    adjacent: "Adjacent chapters",
    sameLayer: "Same-layer skip",
    crossLayer: "Cross-layer jump",
    same: "Same chapter",
    changed: "What chapter B adds",
    add: "Core addition",
    insight: "Key insight",
    source: "Hermes source",
    hint: "Reading advice",
    next: "Recommended next step",
    prev: "Switch to previous chapter of B → B",
    open: "Open chapter B",
    noPrev: "B is already the first chapter.",
    modes: ["Teaching → Teaching", "Teaching → Source", "Source → Teaching", "Source → Source"],
    hints: {
      same: ["This is review mode", "Use it to review structure, not newly added capability."],
      adjacent: ["This is the safest upgrade", "Focus on the exact new branch, state container, or dispatch rule added here."],
      sameLayer: ["This is a same-stage skip", "Skipped chapters usually separate concepts, so check that you did not miss a bridge."],
      crossLayer: ["This is a cross-stage jump", "The hard part is that the system boundary has been redrawn. Stabilize the previous layer first."],
    },
  },
} as const;

export function CompareClient({ locale }: { locale: string }) {
  const t = locale === "zh" ? TEXT.zh : TEXT.en;
  const [a, setA] = useState<Version>("h01");
  const [b, setB] = useState<Version>("h02");

  const metaA = VERSION_META[a];
  const metaB = VERSION_META[b];
  const ia = VERSION_ORDER.indexOf(a);
  const ib = VERSION_ORDER.indexOf(b);
  const distance = Math.abs(ib - ia);
  const prevB = ib > 0 ? VERSION_ORDER[ib - 1] : null;

  const jump = useMemo(() => {
    if (distance === 0) return t.same;
    if (distance === 1) return t.adjacent;
    if (metaA.layer === metaB.layer) return t.sameLayer;
    return t.crossLayer;
  }, [distance, metaA.layer, metaB.layer, t]);

  const mode = useMemo(() => {
    if (metaA.sourceType === "teaching" && metaB.sourceType === "teaching") return t.modes[0];
    if (metaA.sourceType === "teaching" && metaB.sourceType === "snippet") return t.modes[1];
    if (metaA.sourceType === "snippet" && metaB.sourceType === "teaching") return t.modes[2];
    return t.modes[3];
  }, [metaA.sourceType, metaB.sourceType, t]);

  const hint = useMemo(() => {
    if (distance === 0) return t.hints.same;
    if (distance === 1) return t.hints.adjacent;
    if (metaA.layer === metaB.layer) return t.hints.sameLayer;
    return t.hints.crossLayer;
  }, [distance, metaA.layer, metaB.layer, t]);

  return (
    <div className="space-y-8">
      <section className="rounded-[28px] border border-white/[0.06] bg-white/[0.02] p-6 md:p-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs text-white/45">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
          Compare
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">{t.title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/50 md:text-base">{t.sub}</p>

        <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <Picker label={t.a} value={a} onChange={(v) => setA(v as Version)} locale={locale} />
          <Picker label={t.b} value={b} onChange={(v) => setB(v as Version)} locale={locale} />
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm text-white/40">
            <div className="font-mono text-xs text-white/25">Δ</div>
            <div className="mt-1 font-medium text-white/75">{distance}</div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <span className="mr-1 self-center text-xs uppercase tracking-[0.18em] text-white/22">{t.quick}</span>
          {PRESETS.map((preset) => (
            <button
              key={`${preset.a}-${preset.b}`}
              onClick={() => {
                setA(preset.a);
                setB(preset.b);
              }}
              className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white/50 transition-all hover:border-white/15 hover:bg-white/[0.05] hover:text-white/80"
            >
              {preset.a.toUpperCase()} → {preset.b.toUpperCase()}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Stat label={t.distance} value={distance === 0 ? t.same : String(distance)} />
        <Stat label={t.jump} value={jump} />
        <Stat label={t.mode} value={mode} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-5">
          <div className="rounded-[24px] border border-white/[0.06] bg-white/[0.02] p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/25">{t.changed}</p>
                <h2 className="mt-2 text-xl font-semibold text-white/90">{pick(metaB.title, locale)}</h2>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs ${BADGE[metaB.layer]}`}>{metaB.layer}</span>
            </div>
            <Card label={t.add} value={pick(metaB.coreAddition, locale)} color="text-emerald-300" />
            <div className="mt-4" />
            <Card label={t.insight} value={pick(metaB.keyInsight, locale)} color="text-white/75" />
            <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/25">{t.source}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {metaB.hermesSource.map((src) => (
                  <span key={src} className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 font-mono text-xs text-white/55">{src}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Chapter locale={locale} label={t.a} version={a} />
            <Chapter locale={locale} label={t.b} version={b} />
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[24px] border border-white/[0.06] bg-white/[0.02] p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/25">{t.hint}</p>
            <h2 className="mt-2 text-xl font-semibold text-white/90">{hint[0]}</h2>
            <p className="mt-3 text-sm leading-7 text-white/58">{hint[1]}</p>
          </div>

          <div className="rounded-[24px] border border-white/[0.06] bg-white/[0.02] p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/25">{t.next}</p>
            {prevB ? (
              <div className="mt-3 space-y-4">
                <p className="text-sm leading-7 text-white/58">{t.prev}</p>
                <div className="flex flex-wrap gap-3">
                  <button onClick={() => setA(prevB)} className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-white/70 transition-all hover:border-white/15 hover:bg-white/[0.06] hover:text-white">
                    {prevB.toUpperCase()} → {b.toUpperCase()}
                  </button>
                  <Link href={`/${locale}/${b}`} className="rounded-xl border border-white/[0.08] px-4 py-2.5 text-sm text-white/50 transition-all hover:border-white/15 hover:text-white/85">
                    {t.open}
                  </Link>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm leading-7 text-white/58">{t.noPrev}</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Picker({ label, value, onChange, locale }: { label: string; value: string; onChange: (v: string) => void; locale: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-white/25">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-2xl border border-white/[0.08] bg-[#0f0f10] px-4 py-3 text-sm text-white outline-none transition-all hover:border-white/[0.12] focus:border-indigo-500/50">
        {VERSION_ORDER.map((version) => <option key={version} value={version}>{version.toUpperCase()} — {pick(VERSION_META[version].title, locale)}</option>)}
      </select>
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[22px] border border-white/[0.06] bg-white/[0.02] p-5"><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/22">{label}</p><p className="mt-3 text-lg font-semibold text-white/85">{value}</p></div>;
}

function Card({ label, value, color }: { label: string; value: string; color: string }) {
  return <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4"><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/25">{label}</p><p className={`mt-3 text-sm leading-7 ${color}`}>{value}</p></div>;
}

function Chapter({ locale, label, version }: { locale: string; label: string; version: Version }) {
  const meta = VERSION_META[version];
  return (
    <Link href={`/${locale}/${version}`} className="group rounded-[24px] border border-white/[0.06] bg-white/[0.02] p-5 transition-all hover:border-white/15 hover:bg-white/[0.04]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/22">{label}</p>
          <div className="mt-2 flex items-center gap-2"><span className="font-mono text-xs text-white/30">{version.toUpperCase()}</span><span className={`rounded-full border px-2 py-0.5 text-[10px] ${BADGE[meta.layer]}`}>{meta.layer}</span></div>
        </div>
        <span className="text-white/18 transition-all group-hover:text-white/35">→</span>
      </div>
      <h3 className="mt-4 text-lg font-semibold text-white/88 group-hover:text-white">{pick(meta.title, locale)}</h3>
      <p className="mt-2 text-sm leading-7 text-white/48">{pick(meta.subtitle, locale)}</p>
    </Link>
  );
}
