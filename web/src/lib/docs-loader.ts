import fs from "fs";
import path from "path";
import type { Version } from "./constants";

const PROJECT_ROOT = path.join(process.cwd(), "..");
const DOCS_ROOT = path.join(PROJECT_ROOT, "docs");

export interface DocEntry {
  slug: string;
  locale: string;
  kind: "chapter" | "bridge";
  version: Version | null;
  title: string;
  summary: string;
  fileName: string;
}

function docsDir(locale: string) {
  return path.join(DOCS_ROOT, locale);
}

function chapterVersionFromSlug(slug: string): Version | null {
  const prefix = slug.slice(0, 3);
  return /^h\d{2}$/.test(prefix) && slug[3] === "-" ? (prefix as Version) : null;
}

function parseDoc(fileName: string, locale: string): DocEntry | null {
  const abs = path.join(docsDir(locale), fileName);
  try {
    const raw = fs.readFileSync(abs, "utf-8");
    const lines = raw.split(/\r?\n/);
    const slug = fileName.replace(/\.md$/, "");
    const version = chapterVersionFromSlug(slug);
    const titleLine = lines.find((line) => line.startsWith("# "));
    const paragraph = lines.find((line) => line.trim() && !line.startsWith("#") && !line.startsWith("```"));
    return {
      slug,
      locale,
      kind: version ? "chapter" : "bridge",
      version,
      title: titleLine ? titleLine.replace(/^#\s+/, "").trim() : slug,
      summary: paragraph?.trim() ?? "",
      fileName,
    };
  } catch {
    return null;
  }
}

export function listDocs(locale: string): DocEntry[] {
  try {
    return fs
      .readdirSync(docsDir(locale))
      .filter((file) => file.endsWith(".md") && file !== ".gitkeep")
      .map((file) => parseDoc(file, locale))
      .filter((entry): entry is DocEntry => Boolean(entry))
      .sort((a, b) => a.fileName.localeCompare(b.fileName));
  } catch {
    return [];
  }
}

export function getDocBySlug(slug: string, locale: string): DocEntry | null {
  const fileName = `${slug}.md`;
  return parseDoc(fileName, locale);
}

export function getDocMarkdownBySlug(slug: string, locale: string): string | null {
  const fileName = `${slug}.md`;
  const localized = path.join(docsDir(locale), fileName);
  const zhFallback = path.join(docsDir("zh"), fileName);
  const enFallback = path.join(docsDir("en"), fileName);

  for (const abs of [localized, zhFallback, enFallback]) {
    try {
      return fs.readFileSync(abs, "utf-8");
    } catch {
      continue;
    }
  }

  return null;
}

export function listAvailableDocSlugs(): string[] {
  const locales = ["zh", "en"];
  const slugs = new Set<string>();

  for (const locale of locales) {
    for (const doc of listDocs(locale)) {
      slugs.add(doc.slug);
    }
  }

  return Array.from(slugs).sort();
}
