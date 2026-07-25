import docsData from "@/data/generated/docs.json";
import type { Version } from "./constants";

export interface DocEntry {
  slug: string;
  locale: string;
  kind: "chapter" | "bridge";
  version: Version | null;
  title: string;
  summary: string;
  fileName: string;
}

type GeneratedDoc = DocEntry & { markdown: string };
const DOCS = docsData as GeneratedDoc[];

export function listDocs(locale: string): DocEntry[] {
  return DOCS
    .filter((doc) => doc.locale === locale)
    .map(({ markdown: _markdown, ...entry }) => entry)
    .sort((a, b) => a.fileName.localeCompare(b.fileName));
}

export function getDocBySlug(slug: string, locale: string): DocEntry | null {
  const doc = DOCS.find((item) => item.slug === slug && item.locale === locale);
  if (!doc) return null;
  const { markdown: _markdown, ...entry } = doc;
  return entry;
}

export function getDocMarkdownBySlug(slug: string, locale: string): string | null {
  const localized = DOCS.find((item) => item.slug === slug && item.locale === locale);
  const zhFallback = DOCS.find((item) => item.slug === slug && item.locale === "zh");
  const enFallback = DOCS.find((item) => item.slug === slug && item.locale === "en");
  return localized?.markdown ?? zhFallback?.markdown ?? enFallback?.markdown ?? null;
}

export function listAvailableDocSlugs(): string[] {
  return Array.from(new Set(DOCS.map((doc) => doc.slug))).sort();
}
