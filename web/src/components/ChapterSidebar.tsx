import Link from "next/link";
import { LAYER_ORDER, LAYERS, VERSION_META, pick, type Layer, type Version } from "@/lib/constants";

interface Props {
  currentVersion: Version;
  locale: string;
}

const LAYER_COLORS: Record<Layer, { dot: string; heading: string }> = {
  core:      { dot: "bg-blue-500",    heading: "text-blue-400" },
  hardening: { dot: "bg-amber-500",   heading: "text-amber-400" },
  runtime:   { dot: "bg-emerald-500", heading: "text-emerald-400" },
  platform:  { dot: "bg-purple-500",  heading: "text-purple-400" },
};

export function ChapterSidebar({ currentVersion, locale }: Props) {
  return (
    <nav className="py-4 px-2 space-y-4">
      {LAYER_ORDER.map((layerId) => {
        const layer = LAYERS[layerId];
        const colors = LAYER_COLORS[layerId];
        return (
          <div key={layerId}>
            {/* Layer heading */}
            <div className="mb-1.5 flex items-center gap-2 px-2 py-1">
              <div className={`h-2 w-2 rounded-full ${colors.dot} opacity-70`} />
              <span className={`text-[10px] font-bold uppercase tracking-[0.13em] ${colors.heading}`}>
                {locale === "zh" ? layer.labelZh : layer.label}
              </span>
            </div>
            {/* Chapter links */}
            <div className="space-y-px">
              {layer.versions.map((version) => {
                const meta = VERSION_META[version];
                const isActive = version === currentVersion;
                return (
                  <Link
                    key={version}
                    href={`/${locale}/${version}`}
                    className={`flex items-baseline gap-2 rounded-md px-2 py-[7px] text-sm transition-all ${
                      isActive
                        ? "bg-white/[0.07] text-white/90"
                        : "text-white/35 hover:bg-white/[0.04] hover:text-white/70"
                    }`}
                  >
                    <span className={`shrink-0 font-mono text-[11px] ${
                      isActive ? "text-white/40" : "text-white/20"
                    }`}>
                      {version}
                    </span>
                    <span className="text-xs leading-snug">{pick(meta.title, locale)}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
