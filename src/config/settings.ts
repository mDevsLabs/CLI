import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export type ResponseMode = "concise" | "explanative";

export interface OpenAgentSettings {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
  responseMode: ResponseMode;
  defaultPermissionMode?: "standard" | "cautious" | "turbo" | "plan" | "terminal";
  maxTokens?: number;
  setupComplete: boolean;
  mcpServers?: Record<string, McpServerConfig>;
  customInstructionsType?: "text" | "file";
  customInstructionsText?: string;
  customInstructionsFilePath?: string;
  updateChannel?: "stable" | "canary";
  ignoredDirectories?: string[];
  customProviders?: CustomProvider[];
  reddit?: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    username: string;
  };
  x?: {
    apiKey: string;
    apiSecret: string;
    accessToken: string;
    accessSecret: string;
  };
}

export interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface CustomProvider {
  id: string;
  name: string;
  sdk: "openai" | "anthropic" | "google";
  baseUrl: string;
  apiKey: string;
  models: Array<{ id: string; name: string }>;
  createdAt: string;
}

const CONFIG_DIR = join(homedir(), ".mai");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

function ensureConfigDir() {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function getConfigDir(): string {
  ensureConfigDir();
  return CONFIG_DIR;
}

export function loadSettings(): OpenAgentSettings {
  ensureConfigDir();

  if (!existsSync(CONFIG_FILE)) {
    return {
      provider: "",
      model: "",
      apiKey: "",
      responseMode: "concise",
      defaultPermissionMode: "standard",
      setupComplete: false,
    };
  }

  try {
    const raw = readFileSync(CONFIG_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {
      provider: "",
      model: "",
      apiKey: "",
      responseMode: "concise",
      defaultPermissionMode: "standard",
      setupComplete: false,
    };
  }
}

export function saveSettings(settings: OpenAgentSettings): void {
  ensureConfigDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(settings, null, 2));
}

export function updateSettings(partial: Partial<OpenAgentSettings>): OpenAgentSettings {
  const current = loadSettings();
  const updated = { ...current, ...partial };
  saveSettings(updated);
  return updated;
}

export function isSetupComplete(): boolean {
  const s = loadSettings();
  return s.setupComplete && !!s.provider && !!s.model;
}

export function getCustomProviders(): CustomProvider[] {
  const s = loadSettings();
  return s.customProviders || [];
}

export function addCustomProvider(provider: CustomProvider): void {
  const s = loadSettings();
  if (!s.customProviders) s.customProviders = [];
  const existingIndex = s.customProviders.findIndex((p) => p.id === provider.id);
  if (existingIndex >= 0) {
    s.customProviders[existingIndex] = provider;
  } else {
    s.customProviders.push(provider);
  }
  saveSettings(s);
}

export function removeCustomProvider(id: string): void {
  const s = loadSettings();
  if (!s.customProviders) return;
  s.customProviders = s.customProviders.filter((p) => p.id !== id);
  saveSettings(s);
}

export function getCustomProvider(id: string): CustomProvider | undefined {
  return getCustomProviders().find((p) => p.id === id);
}

export function addModelToCustomProvider(providerId: string, model: { id: string; name: string }): void {
  const s = loadSettings();
  if (!s.customProviders) return;
  const p = s.customProviders.find((x) => x.id === providerId);
  if (p) {
    p.models.push(model);
    saveSettings(s);
  }
}

export function getSessionsDir(): string {
  const dir = join(CONFIG_DIR, "sessions");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function getContextSessionPath(cwd: string): string {
  const safeName = cwd.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 100);
  return join(CONFIG_DIR, "sessions", `CONTEXT_${safeName}.session`);
}
