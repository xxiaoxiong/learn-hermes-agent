import path from "path";
import fs from "fs";
import type { Version } from "./constants";

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

/** Project root = one level above web/.
 *  Locally:  process.cwd() = .../learn-hermes-agent/web  → .. works
 *  Vercel:   process.cwd() = /vercel/path0/web            → .. works
 *  Fallback: walk up from __dirname until we find agents/  */
function findProjectRoot(): string {
  // 1. Try cwd/..
  const fromCwd = path.resolve(process.cwd(), "..");
  if (fs.existsSync(path.join(fromCwd, "agents"))) return fromCwd;
  // 2. Walk up from this file's directory
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
    if (fs.existsSync(path.join(dir, "agents"))) return dir;
  }
  // 3. Fallback
  return fromCwd;
}
const PROJECT_ROOT = findProjectRoot();

export function getSourceCode(version: Version): string | null {
  const rel = SOURCE_FILE_MAP[version];
  if (!rel) return null;
  const abs = path.join(PROJECT_ROOT, rel);
  try {
    return fs.readFileSync(abs, "utf-8");
  } catch {
    return null;
  }
}

export function getSourceFileName(version: Version): string {
  return SOURCE_FILE_MAP[version] ?? "";
}

export function getDocMarkdown(version: Version, locale: string = "zh"): string | null {
  const fileName = DOC_FILE_MAP[version];
  if (!fileName) return null;
  const abs = path.join(PROJECT_ROOT, "docs", locale, fileName);
  try {
    return fs.readFileSync(abs, "utf-8");
  } catch {
    return null;
  }
}
