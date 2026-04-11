"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Version } from "@/lib/constants";
import { EXECUTION_FLOWS } from "@/data/execution-flows";

const LANE_STYLE: Record<string, { border: string; bg: string; text: string; dot: string; glow: string }> = {
  input:    { border: "border-sky-500/30",    bg: "bg-sky-500/[0.06]",    text: "text-sky-400",    dot: "bg-sky-400",    glow: "shadow-sky-500/20" },
  decision: { border: "border-violet-500/30", bg: "bg-violet-500/[0.06]", text: "text-violet-400", dot: "bg-violet-400", glow: "shadow-violet-500/20" },
  action:   { border: "border-emerald-500/30",bg: "bg-emerald-500/[0.06]",text: "text-emerald-400",dot: "bg-emerald-400",glow: "shadow-emerald-500/20" },
  state:    { border: "border-amber-500/30",  bg: "bg-amber-500/[0.06]",  text: "text-amber-400",  dot: "bg-amber-400",  glow: "shadow-amber-500/20" },
};

const LANE_LABEL: Record<string, { zh: string; en: string }> = {
  input: { zh: "输入", en: "Input" },
  decision: { zh: "判断", en: "Decision" },
  action: { zh: "动作", en: "Action" },
  state: { zh: "状态", en: "State" },
};

export function ExecutionFlowStepper({ version }: { version: Version }) {
  const locale = useLocale();
  const t = useTranslations();
  const flow = EXECUTION_FLOWS[version];
  const [activeStep, setActiveStep] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);

  const stepCount = flow?.steps.length ?? 0;
  const pick = (s: { zh: string; en: string }) => locale === "zh" ? s.zh : s.en;

  const advance = useCallback(() => {
    setActiveStep((prev) => {
      if (prev >= stepCount - 1) {
        setIsPlaying(false);
        return stepCount - 1;
      }
      return prev + 1;
    });
  }, [stepCount]);

  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(advance, 1200);
    return () => clearInterval(id);
  }, [isPlaying, advance]);

  if (!flow) return null;

  const handlePlayPause = () => {
    if (activeStep >= stepCount - 1) {
      setActiveStep(-1);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const handleReset = () => {
    setActiveStep(-1);
    setIsPlaying(false);
  };

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-1 w-4 rounded-full bg-cyan-400/70" />
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/25">
            {t("chapter.executionFlow")}
          </span>
        </div>
        {/* Playback controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleReset}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-white/30 transition-all hover:bg-white/[0.06] hover:text-white/60"
            title="Reset"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2v3.5h3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M2.5 5.5A4 4 0 1 1 2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
          <button
            onClick={() => { if (activeStep > 0) setActiveStep(activeStep - 1); }}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-white/30 transition-all hover:bg-white/[0.06] hover:text-white/60"
            title="Previous"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <button
            onClick={handlePlayPause}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.05] text-white/50 transition-all hover:bg-white/[0.08] hover:text-white/80"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="2" y="1" width="3" height="10" rx="1"/><rect x="7" y="1" width="3" height="10" rx="1"/></svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M3 1.5v9l7-4.5-7-4.5z"/></svg>
            )}
          </button>
          <button
            onClick={() => { if (activeStep < stepCount - 1) setActiveStep(activeStep + 1); }}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-white/30 transition-all hover:bg-white/[0.06] hover:text-white/60"
            title="Next"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>

      {/* Summary */}
      <p className="mb-5 text-sm leading-relaxed text-white/65">{pick(flow.summary)}</p>

      {/* Progress bar */}
      <div className="mb-5 flex gap-1">
        {flow.steps.map((_, idx) => (
          <button
            key={idx}
            onClick={() => { setActiveStep(idx); setIsPlaying(false); }}
            className={`h-1 flex-1 rounded-full transition-all duration-500 ${
              idx <= activeStep ? "bg-cyan-400/70" : "bg-white/[0.08]"
            }`}
          />
        ))}
      </div>

      {/* Steps */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {flow.steps.map((item, idx) => {
          const style = LANE_STYLE[item.lane];
          const isActive = idx === activeStep;
          const isPast = idx < activeStep;
          const isFuture = idx > activeStep && activeStep >= 0;
          return (
            <button
              key={idx}
              onClick={() => { setActiveStep(idx); setIsPlaying(false); }}
              className={`rounded-xl border p-4 text-left transition-all duration-500 ${
                isActive
                  ? `${style.border} ${style.bg} shadow-lg ${style.glow} scale-[1.02]`
                  : isPast
                    ? "border-white/[0.08] bg-white/[0.03]"
                    : isFuture
                      ? "border-white/[0.04] bg-white/[0.01] opacity-50"
                      : "border-white/[0.06] bg-white/[0.025]"
              }`}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-all duration-500 ${
                  isActive ? `${style.bg} ${style.text}` : "bg-white/[0.08] text-white/50"
                }`}>
                  {idx + 1}
                </span>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.15em] transition-all duration-500 ${
                  isActive ? `${style.border} ${style.bg} ${style.text}` : "border-white/[0.06] bg-white/[0.03] text-white/25"
                }`}>
                  {locale === "zh" ? LANE_LABEL[item.lane].zh : LANE_LABEL[item.lane].en}
                </span>
              </div>
              <h3 className={`text-sm font-semibold transition-all duration-500 ${
                isActive ? "text-white/90" : "text-white/70"
              }`}>{pick(item.title)}</h3>
              <p className={`mt-2 text-xs leading-5 transition-all duration-500 ${
                isActive ? "text-white/65" : "text-white/40"
              }`}>{pick(item.detail)}</p>

              {/* Animated connector arrow between steps */}
              {idx < flow.steps.length - 1 && (
                <div className={`mt-3 flex justify-center xl:hidden transition-opacity duration-500 ${
                  isActive ? "opacity-60" : "opacity-20"
                }`}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 3v10M4 9l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/30" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Step counter */}
      <div className="mt-4 text-center">
        <span className="font-mono text-[10px] text-white/20">
          {activeStep >= 0 ? `${activeStep + 1} / ${stepCount}` : `— / ${stepCount}`}
        </span>
      </div>
    </div>
  );
}
