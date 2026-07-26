import {
  readFileSync,
  writeFileSync,
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { getSessionsDir, getContextSessionPath } from "../config/settings.js";
import type { ProviderMessage } from "../providers/types.js";

export interface SessionMeta {
  id: string;
  cwd: string;
  provider: string;
  model: string;
  startedAt: number;
  lastActiveAt: number;
  messageCount: number;
  summary: string;
}

export interface Session {
  meta: SessionMeta;
  messages: ProviderMessage[];
}

function getSessionDir(sessionId: string): string {
  const dir = join(getSessionsDir(), sessionId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function createSession(cwd: string, provider: string, model: string): SessionMeta {
  const id = randomUUID();
  const meta: SessionMeta = {
    id,
    cwd,
    provider,
    model,
    startedAt: Date.now(),
    lastActiveAt: Date.now(),
    messageCount: 0,
    summary: "",
  };

  const dir = getSessionDir(id);
  writeFileSync(join(dir, "meta.json"), JSON.stringify(meta, null, 2));
  writeFileSync(join(dir, "messages.jsonl"), "");

  return meta;
}

export function appendMessage(sessionId: string, message: ProviderMessage): void {
  const dir = getSessionDir(sessionId);
  appendFileSync(join(dir, "messages.jsonl"), JSON.stringify(message) + "\n");

  const metaPath = join(dir, "meta.json");
  if (existsSync(metaPath)) {
    try {
      const meta: SessionMeta = JSON.parse(readFileSync(metaPath, "utf-8"));
      meta.lastActiveAt = Date.now();
      meta.messageCount++;
      if (message.role === "user" && !meta.summary) {
        if (typeof message.content === "string") {
          meta.summary = message.content.slice(0, 100);
        } else if (Array.isArray(message.content)) {
          const textPart = message.content.find((part: any) => typeof part === "string" || part?.text);
          const str = typeof textPart === "string" ? textPart : textPart?.text || "";
          if (str) meta.summary = str.slice(0, 100);
        }
      }
      writeFileSync(metaPath, JSON.stringify(meta, null, 2));
    } catch {}
  }
}

export function renameSession(sessionId: string, newSummary: string): boolean {
  const dir = join(getSessionsDir(), sessionId);
  const metaPath = join(dir, "meta.json");

  if (!existsSync(metaPath)) return false;

  try {
    const meta: SessionMeta = JSON.parse(readFileSync(metaPath, "utf-8"));
    meta.summary = newSummary.trim();
    writeFileSync(metaPath, JSON.stringify(meta, null, 2));
    return true;
  } catch {
    return false;
  }
}

export function loadSession(sessionId: string): Session | null {
  const dir = join(getSessionsDir(), sessionId);
  const metaPath = join(dir, "meta.json");
  const messagesPath = join(dir, "messages.jsonl");

  if (!existsSync(metaPath) || !existsSync(messagesPath)) return null;

  try {
    const meta: SessionMeta = JSON.parse(readFileSync(metaPath, "utf-8"));
    const lines = readFileSync(messagesPath, "utf-8").trim().split("\n").filter(Boolean);
    const messages: ProviderMessage[] = lines.map((l) => JSON.parse(l));
    return { meta, messages };
  } catch {
    return null;
  }
}

export function listSessions(cwd?: string): SessionMeta[] {
  const sessionsDir = getSessionsDir();
  if (!existsSync(sessionsDir)) return [];

  const entries = readdirSync(sessionsDir, { withFileTypes: true });
  const sessions: SessionMeta[] = [];
  const normalizedTargetCwd = cwd ? resolve(cwd).toLowerCase() : "";

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const metaPath = join(sessionsDir, entry.name, "meta.json");
    if (!existsSync(metaPath)) continue;

    try {
      const meta: SessionMeta = JSON.parse(readFileSync(metaPath, "utf-8"));
      const normalizedMetaCwd = meta.cwd ? resolve(meta.cwd).toLowerCase() : "";
      if (!cwd || normalizedMetaCwd === normalizedTargetCwd) {
        sessions.push(meta);
      }
    } catch {}
  }

  return sessions.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
}

export function updateContextSession(cwd: string, summary: string): void {
  const path = getContextSessionPath(cwd);
  const timestamp = new Date().toISOString();
  const entry = `\n--- Session ${timestamp} ---\n${summary}\n`;
  appendFileSync(path, entry);
}

export function loadContextSession(cwd: string): string {
  const path = getContextSessionPath(cwd);
  if (!existsSync(path)) return "";
  try {
    const content = readFileSync(path, "utf-8");
    const maxLength = 8000;
    if (content.length > maxLength) {
      return content.slice(content.length - maxLength);
    }
    return content;
  } catch {
    return "";
  }
}
