import versionsData from "@/data/generated/versions.json";
import type { Version } from "./constants";

type GeneratedVersion = {
  id: Version;
  sourceFile: string;
  source: string;
  docContent: Partial<Record<"zh" | "en", string>>;
};

const VERSIONS = versionsData as GeneratedVersion[];

function getGeneratedVersion(version: Version) {
  return VERSIONS.find((item) => item.id === version) ?? null;
}

export function getSourceCode(version: Version): string | null {
  return getGeneratedVersion(version)?.source ?? null;
}

export function getSourceFileName(version: Version): string {
  return getGeneratedVersion(version)?.sourceFile ?? "";
}

export function getDocMarkdown(version: Version, locale: string = "zh"): string | null {
  const record = getGeneratedVersion(version);
  if (!record) return null;
  if (locale === "en") return record.docContent.en ?? record.docContent.zh ?? null;
  return record.docContent.zh ?? record.docContent.en ?? null;
}
