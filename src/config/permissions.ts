import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getConfigDir } from "./settings.js";

export type PermissionMode = "standard" | "cautious" | "turbo" | "plan";

export interface PermissionRule {
  tool: string;
  behavior: "allow" | "deny" | "ask";
  pattern?: string;
}

export interface PermissionState {
  mode: PermissionMode;
  globalRules: PermissionRule[];
  projectRules: PermissionRule[];
  confirmedTurboDirs: string[];
}

const PERMISSIONS_FILE = "permissions.json";

/** 📖 Read-only + planning tools allowed in Plan mode (no side effects). */
export const PLAN_ALLOWED_TOOLS = new Set([
  "FileRead",
  "Glob",
  "Grep",
  "WebSearch",
  "WebFetch",
  "TodoWrite",
]);

/** Tools that always prompt in Standard mode (mutating / network side effects). */
const STANDARD_ALWAYS_ASK = new Set([
  "Bash",
  "FileWrite",
  "FileEdit",
  "RedditPost",
  "XPost",
  "Upload",
]);

const MODE_META: Record<
  PermissionMode,
  { label: string; symbol: string; color: string; description: string }
> = {
  standard: {
    label: "Standard",
    symbol: "~",
    color: "yellow",
    description: "Asks before file writes, shell commands, and network side effects",
  },
  cautious: {
    label: "Cautious",
    symbol: "!",
    color: "red",
    description: "Asks before every tool execution",
  },
  turbo: {
    label: "Turbo",
    symbol: "*",
    color: "magenta",
    description: "Full autonomy — all tools and commands auto-approved, deny rules ignored",
  },
  plan: {
    label: "Plan",
    symbol: "P",
    color: "blue",
    description: "Read-only planning — explore and design only, no writes or shell commands",
  },
};

/** Ctrl+T cycle order (Terminal is handled separately in the REPL). */
export const CTRL_T_MODE_CYCLE: PermissionMode[] = ["standard", "plan", "turbo"];

export function getModeMeta(mode: PermissionMode) {
  return MODE_META[mode];
}

export function getAllModes() {
  return Object.entries(MODE_META).map(([id, meta]) => ({
    id: id as PermissionMode,
    ...meta,
  }));
}

/** Next mode label for the Ctrl+T placeholder (permission modes only). */
export function getNextCtrlTModeLabel(
  current: PermissionMode,
  terminalMode: boolean
): string {
  if (terminalMode) return "standard";
  if (current === "standard") return "plan";
  if (current === "plan") return "turbo";
  return "terminal"; // turbo (or cautious) → terminal
}

function getPermissionsPath(): string {
  return join(getConfigDir(), PERMISSIONS_FILE);
}

function getProjectPermissionsPath(): string {
  return join(process.cwd(), ".mai", "permissions.json");
}

export function loadPermissions(): PermissionState {
  const path = getPermissionsPath();
  if (!existsSync(path)) {
    return {
      mode: "standard",
      globalRules: [],
      projectRules: [],
      confirmedTurboDirs: [],
    };
  }

  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return {
      mode: "standard",
      globalRules: [],
      projectRules: [],
      confirmedTurboDirs: [],
    };
  }
}

export function savePermissions(state: PermissionState): void {
  writeFileSync(getPermissionsPath(), JSON.stringify(state, null, 2));
}

export function getEffectiveMode(): PermissionMode {
  return loadPermissions().mode;
}

export function setMode(mode: PermissionMode): void {
  const state = loadPermissions();
  state.mode = mode;
  savePermissions(state);
}

export function isTurboConfirmedForDir(dir: string): boolean {
  const state = loadPermissions();
  return state.confirmedTurboDirs.includes(dir);
}

export function confirmTurboForDir(dir: string): void {
  const state = loadPermissions();
  if (!state.confirmedTurboDirs.includes(dir)) {
    state.confirmedTurboDirs.push(dir);
  }
  state.mode = "turbo";
  savePermissions(state);
}

export function addRule(rule: PermissionRule, scope: "global" | "project"): void {
  const state = loadPermissions();
  const list = scope === "global" ? state.globalRules : state.projectRules;
  const existing = list.findIndex(
    (r) => r.tool === rule.tool && r.pattern === rule.pattern
  );
  if (existing >= 0) {
    list[existing] = rule;
  } else {
    list.push(rule);
  }
  savePermissions(state);
}

export function removeRule(tool: string, scope: "global" | "project"): void {
  const state = loadPermissions();
  if (scope === "global") {
    state.globalRules = state.globalRules.filter((r) => r.tool !== tool);
  } else {
    state.projectRules = state.projectRules.filter((r) => r.tool !== tool);
  }
  savePermissions(state);
}

/** Whether a tool is allowed under the current permission mode (before rules). */
export function isToolAllowedInMode(toolName: string, mode?: PermissionMode): boolean {
  const effective = mode ?? getEffectiveMode();
  if (effective === "plan") {
    return PLAN_ALLOWED_TOOLS.has(toolName);
  }
  // standard, cautious, turbo — all tools available (rules may still apply)
  return true;
}

/**
 * Returns true if the tool should be blocked entirely.
 * ⚡ Turbo never denies — every tool and command is allowed.
 * 📋 Plan denies all mutating / shell tools.
 */
export function isDenied(toolName: string): boolean {
  const state = loadPermissions();

  // ⚡ Turbo: full access — ignore deny rules and plan restrictions
  if (state.mode === "turbo") return false;

  // 📋 Plan: block anything that can change the system
  if (state.mode === "plan" && !PLAN_ALLOWED_TOOLS.has(toolName)) {
    return true;
  }

  const allRules = [...state.projectRules, ...state.globalRules];
  for (const rule of allRules) {
    if ((rule.tool === toolName || rule.tool === "*") && rule.behavior === "deny") {
      return true;
    }
  }
  return false;
}

/**
 * Returns true if the user should be prompted before running the tool.
 * ⚡ Turbo never prompts.
 * 📋 Plan does not prompt for allowed tools (read-only); blocked tools are denied instead.
 */
export function shouldPrompt(toolName: string): boolean {
  const state = loadPermissions();

  // ⚡ Turbo: zero friction — auto-approve everything
  if (state.mode === "turbo") return false;

  // 📋 Plan: only read/plan tools run, and they never need a prompt
  if (state.mode === "plan") return false;

  // ❗ Cautious: always ask
  if (state.mode === "cautious") return true;

  // Custom allow / deny / ask rules (project first, then global)
  const allRules = [...state.projectRules, ...state.globalRules];
  for (const rule of allRules) {
    if (rule.tool === toolName || rule.tool === "*") {
      if (rule.behavior === "allow") return false;
      if (rule.behavior === "deny") return false; // denied separately via isDenied
      if (rule.behavior === "ask") return true;
    }
  }

  return STANDARD_ALWAYS_ASK.has(toolName);
}

/** Human-readable reason when a tool is blocked by mode. */
export function getDeniedReason(toolName: string): string {
  const mode = getEffectiveMode();
  if (mode === "plan" && !PLAN_ALLOWED_TOOLS.has(toolName)) {
    return (
      `Tool "${toolName}" is blocked in Plan mode. ` +
      `Plan mode is read-only (FileRead, Glob, Grep, WebSearch, WebFetch, TodoWrite). ` +
      `Switch to Standard or Turbo (Ctrl+T) to execute changes.`
    );
  }
  return `Tool "${toolName}" is blocked by permission rules.`;
}
