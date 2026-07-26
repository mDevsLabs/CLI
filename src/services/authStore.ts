import { join } from "node:path";
import { homedir } from "node:os";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import crypto from "node:crypto";

const MAI_DIR = join(homedir(), ".mai");
const DATA_FILE = join(MAI_DIR, ".mdata");
const SECRET_KEY = crypto.scryptSync("mai-cli-secret-key-v1", "mai-salt", 32);

export type Tier = "Free" | "Plus" | "Pro" | "Max";

export interface AuthState {
  email: string | null;
  username: string | null;
  passwordHash: string | null;
  authToken: string | null;  // JWT from Val Town API (14 days)
  tier: Tier;
  tokensUsed: number;
  weekStart: string;
}

const DEFAULT_STATE: AuthState = {
  email: null,
  username: null,
  passwordHash: null,
  authToken: null,
  tier: "Free",
  tokensUsed: 0,
  weekStart: getStartOfWeek(),
};

export const TIER_LIMITS: Record<Tier, number> = {
  Free: 2000000,
  Plus: 5000000,
  Pro: 7000000,
  Max: 10000000,
};

function getStartOfWeek(): string {
  const now = new Date();
  const day = now.getDay() || 7;
  if (day !== 1) now.setHours(-24 * (day - 1));
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", SECRET_KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decrypt(text: string): string {
  try {
    const parts = text.split(":");
    const iv = Buffer.from(parts.shift() as string, "hex");
    const encrypted = parts.join(":");
    const decipher = crypto.createDecipheriv("aes-256-cbc", SECRET_KEY, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (e) {
    return "";
  }
}

export function loadAuthState(): AuthState {
  if (!existsSync(MAI_DIR)) mkdirSync(MAI_DIR, { recursive: true });
  if (!existsSync(DATA_FILE)) {
    saveAuthState(DEFAULT_STATE);
    return DEFAULT_STATE;
  }

  const raw = readFileSync(DATA_FILE, "utf-8");
  const decrypted = decrypt(raw);
  if (!decrypted) {
    saveAuthState(DEFAULT_STATE);
    return DEFAULT_STATE;
  }

  try {
    const data = JSON.parse(decrypted) as AuthState;
    const currentWeekStart = getStartOfWeek();
    if (data.weekStart !== currentWeekStart) {
      data.weekStart = currentWeekStart;
      data.tokensUsed = 0;
      saveAuthState(data);
    }
    return data;
  } catch {
    saveAuthState(DEFAULT_STATE);
    return DEFAULT_STATE;
  }
}

export function saveAuthState(state: AuthState) {
  if (!existsSync(MAI_DIR)) mkdirSync(MAI_DIR, { recursive: true });
  const encrypted = encrypt(JSON.stringify(state));
  writeFileSync(DATA_FILE, encrypted, "utf-8");
}

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export function login(email: string, passwordHash: string) {
  const state = loadAuthState();
  state.email = email;
  state.passwordHash = passwordHash;
  saveAuthState(state);
}

export function verifyPassword(password: string): boolean {
  const state = loadAuthState();
  if (!state.passwordHash) return true; // Si aucun mot de passe n'a été défini
  return state.passwordHash === hashPassword(password);
}

export function updateProfile(updates: Partial<AuthState>) {
  const state = loadAuthState();
  Object.assign(state, updates);
  saveAuthState(state);
}

export function logout() {
  const state = loadAuthState();
  state.email = null;
  state.tier = "Free";
  state.passwordHash = null;
  state.authToken = null;
  state.username = null;
  saveAuthState(state);
}

export function updateTier(tier: Tier) {
  const state = loadAuthState();
  state.tier = tier;
  saveAuthState(state);
}

export function addTokens(tokens: number): number {
  const state = loadAuthState();
  
  if (state.tokensUsed + tokens > TIER_LIMITS[state.tier]) {
    throw new Error(`Limite de ${TIER_LIMITS[state.tier] / 1000000}M tokens atteinte pour le forfait ${state.tier}. 🛑`);
  }
  
  if (tokens > 0) {
    state.tokensUsed += tokens;
    saveAuthState(state);
  }
  
  return state.tokensUsed;
}
