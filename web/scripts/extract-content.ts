import fs from "fs";
import path from "path";
import { VERSION_META, VERSION_ORDER, type Version, type I18nStr } from "../src/lib/constants";

type Locale = "zh" | "en";
type SourceKind = "agents" | "snippets";

interface VersionRecord {
  id: Version;
  title: I18nStr;
  subtitle: I18nStr;
  coreAddition: I18nStr;
  keyInsight: I18nStr;
  layer: string;
  sourceType: "teaching" | "snippet";
  sourceKind: SourceKind;
  sourceFile: string;
  sourceExists: boolean;
  sourceLineCount: number;
  sourceCharCount: number;
  hermesSource: string[];
  docFiles: Partial<Record<Locale, string>>;
}

interface DocRecord {
  slug: string;
  locale: Locale;
  kind: "chapter" | "bridge";
  title: string;
  summary: string;
  fileName: string;
  version: Version | null;
}

const WEB_ROOT = path.resolve(__dirname, "..");
const PROJECT_ROOT = path.resolve(WEB_ROOT, "..");
const DOCS_ROOT = path.join(PROJECT_ROOT, "docs");
const OUT_DIR = path.join(WEB_ROOT, "src", "data", "generated");

const SOURCE_FILE_MAP: Record<Version, string> = {
  h01: "agents/h01_agent_loop.py",
  h02: "agents/h02_tool_system.py",
  h03: "agents/h03_planning_todos.py",
  h04: "agents/h04_prompt_assembly.py",
  h05: "agents/h05_context_compression.py",
  h06: "agents/h06_session_storage.py",
  h07: "snippets/h07_memory_system.py",
  h08: "snippets/h08_skills_system.py",
  h09: "snippets/h09_approval_permission.py",
  h10: "snippets/h10_error_recovery.py",
  h11: "snippets/h11_cli_architecture.py",
  h12: "snippets/h12_gateway.py",
  h13: "snippets/h13_cron_scheduler.py",
  h14: "snippets/h14_hooks_system.py",
  h15: "snippets/h15_subagent.py",
  h16: "snippets/h16_provider_runtime.py",
  h17: "snippets/h17_mcp_protocol.py",
  h18: "snippets/h18_plugin_system.py",
  h19: "snippets/h19_rl_training.py",
};

const DOC_FILE_MAP: Record<Version, string> = {
  h01: "h01-agent-loop.md",
  h02: "h02-tool-system.md",
  h03: "h03-planning-todos.md",
  h04: "h04-prompt-assembly.md",
  h05: "h05-context-compression.md",
  h06: "h06-session-storage.md",
  h07: "h07-memory-system.md",
  h08: "h08-skills-system.md",
  h09: "h09-approval-permission.md",
  h10: "h10-error-recovery.md",
  h11: "h11-cli-architecture.md",
  h12: "h12-gateway-system.md",
  h13: "h13-cron-scheduler.md",
  h14: "h14-hook-system.md",
  h15: "h15-subagent-delegation.md",
  h16: "h16-provider-runtime.md",
  h17: "h17-mcp-integration.md",
  h18: "h18-plugin-system.md",
  h19: "h19-rl-trajectories.md",
};

function readIfExists(filePath: string) {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

function summarize(markdown: string) {
  const lines = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("#"))
    .filter((line) => !line.startsWith("```"))
    .filter((line) => !line.startsWith("|---"));

  return lines[0] ?? "";
}

function titleOf(markdown: string, fallback: string) {
  const line = markdown.split(/\r?\n/).find((item) => item.startsWith("# "));
  return line ? line.replace(/^#\s+/, "").trim() : fallback;
}

function chapterVersionFromSlug(slug: string): Version | null {
  const match = slug.match(/^(h\d{2})-/);
  return match ? (match[1] as Version) : null;
}

function collectVersions(): VersionRecord[] {
  return VERSION_ORDER.map((version) => {
    const meta = VERSION_META[version];
    const relSource = SOURCE_FILE_MAP[version];
    const sourceAbs = path.join(PROJECT_ROOT, relSource);
    const source = readIfExists(sourceAbs) ?? "";
    const sourceKind: SourceKind = relSource.startsWith("agents/") ? "agents" : "snippets";
    const docFile = DOC_FILE_MAP[version];
    const zhDoc = readIfExists(path.join(DOCS_ROOT, "zh", docFile));
    const enDoc = readIfExists(path.join(DOCS_ROOT, "en", docFile));

    return {
      id: version,
      title: meta.title,
      subtitle: meta.subtitle,
      coreAddition: meta.coreAddition,
      keyInsight: meta.keyInsight,
      layer: meta.layer,
      sourceType: meta.sourceType,
      sourceKind,
      sourceFile: relSource,
      sourceExists: Boolean(source),
      sourceLineCount: source ? source.split(/\r?\n/).length : 0,
      sourceCharCount: source.length,
      hermesSource: meta.hermesSource,
      docFiles: {
        zh: zhDoc ? path.posix.join("docs", "zh", docFile) : undefined,
        en: enDoc ? path.posix.join("docs", "en", docFile) : undefined,
      },
    };
  });
}

function collectDocs(): DocRecord[] {
  const locales: Locale[] = ["zh", "en"];
  const docs: DocRecord[] = [];

  for (const locale of locales) {
    const dir = path.join(DOCS_ROOT, locale);
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir).filter((file) => file.endsWith(".md") && file !== ".gitkeep");
    for (const fileName of files) {
      const markdown = readIfExists(path.join(dir, fileName));
      if (!markdown) continue;
      const slug = fileName.replace(/\.md$/, "");
      const version = chapterVersionFromSlug(slug);

      docs.push({
        slug,
        locale,
        kind: version ? "chapter" : "bridge",
        title: titleOf(markdown, slug),
        summary: summarize(markdown),
        fileName,
        version,
      });
    }
  }

  return docs.sort((a, b) => `${a.locale}-${a.slug}`.localeCompare(`${b.locale}-${b.slug}`));
}

function main() {
  const versions = collectVersions();
  const docs = collectDocs();

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "versions.json"), `${JSON.stringify(versions, null, 2)}\n`);
  fs.writeFileSync(path.join(OUT_DIR, "docs.json"), `${JSON.stringify(docs, null, 2)}\n`);

  console.log(`Generated ${versions.length} versions -> src/data/generated/versions.json`);
  console.log(`Generated ${docs.length} docs -> src/data/generated/docs.json`);
}

main();
