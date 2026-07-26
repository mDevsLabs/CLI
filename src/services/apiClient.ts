/**
 * apiClient.ts — Wrapper fetch vers l'API Val Town (mai-db.val.run)
 * Gère le JWT en cache local (via authStore) et toutes les routes backend.
 */

import { loadAuthState, saveAuthState, type Tier } from "./authStore.js";

const API_URL = "https://mai.val.run";

export interface ApiUser {
  id?: string;
  email: string;
  username?: string | null;
  tier: Tier;
}

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  status: number;
}

// ─────────────────────────────────────────────
// Helper fetch avec timeout et auth header
// ─────────────────────────────────────────────
async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  withAuth = false
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };

  if (withAuth) {
    const state = loadAuthState();
    if (state.authToken) {
      headers["Authorization"] = `Bearer ${state.authToken}`;
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000); // 10s timeout

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { error: (json as any).error || `Erreur HTTP ${res.status}`, status: res.status };
    }

    return { data: json as T, status: res.status };
  } catch (err: any) {
    if (err.name === "AbortError") {
      return { error: "Délai d'attente dépassé. Vérifie ta connexion.", status: 408 };
    }
    return { error: "Impossible de contacter le serveur. Mode hors ligne.", status: 0 };
  } finally {
    clearTimeout(timeout);
  }
}

// ─────────────────────────────────────────────
// POST /register
// ─────────────────────────────────────────────
export async function apiRegister(
  email: string,
  password: string,
  username?: string
): Promise<ApiResponse<{ token: string; user: ApiUser }>> {
  const res = await apiFetch<{ token: string; user: ApiUser }>("/register", {
    method: "POST",
    body: JSON.stringify({ email, password, username }),
  });

  if (res.data?.token) {
    // Persister la session
    const state = loadAuthState();
    state.authToken = res.data.token;
    state.email = res.data.user.email;
    state.username = res.data.user.username || null;
    state.tier = res.data.user.tier;
    state.tokensUsed = 0;
    saveAuthState(state);
  }

  return res;
}

// ─────────────────────────────────────────────
// POST /login
// ─────────────────────────────────────────────
export async function apiLogin(
  email: string,
  password: string
): Promise<ApiResponse<{ token: string; user: ApiUser }>> {
  const res = await apiFetch<{ token: string; user: ApiUser }>("/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  if (res.data?.token) {
    const state = loadAuthState();
    state.authToken = res.data.token;
    state.email = res.data.user.email;
    state.username = res.data.user.username || null;
    state.tier = res.data.user.tier;
    saveAuthState(state);
  }

  return res;
}

// ─────────────────────────────────────────────
// POST /log-usage
// ─────────────────────────────────────────────
export async function apiLogUsage(
  tokensUsed: number,
  actionType = "chat",
  metadata: Record<string, unknown> = {}
): Promise<ApiResponse<{ weeklyUsed: number; limit: number }>> {
  return apiFetch<{ weeklyUsed: number; limit: number }>("/log-usage", {
    method: "POST",
    body: JSON.stringify({ tokensUsed, actionType, metadata }),
  }, true);
}

// ─────────────────────────────────────────────
// GET /usage
// ─────────────────────────────────────────────
export interface UsageData {
  tier: Tier;
  email: string;
  username?: string | null;
  tokensUsed: number;
  limit: number;
  weekStart: string;
}

export async function apiGetUsage(): Promise<ApiResponse<UsageData>> {
  return apiFetch<UsageData>("/usage", { method: "GET" }, true);
}

// ─────────────────────────────────────────────
// POST /update-profile
// ─────────────────────────────────────────────
export async function apiUpdateProfile(
  currentPassword: string,
  updates: { email?: string; username?: string; newPassword?: string }
): Promise<ApiResponse<{ token: string; user: ApiUser }>> {
  const res = await apiFetch<{ token: string; user: ApiUser }>("/update-profile", {
    method: "POST",
    body: JSON.stringify({ currentPassword, ...updates }),
  }, true);

  if (res.data?.token) {
    const state = loadAuthState();
    state.authToken = res.data.token;
    if (updates.email) state.email = updates.email;
    if (updates.username) state.username = updates.username;
    saveAuthState(state);
  }

  return res;
}

// POST /verify-code (upgrade forfait)
// ─────────────────────────────────────────────
export async function apiVerifyCode(
  code: string
): Promise<ApiResponse<{ tier: Tier; token: string }>> {
  const res = await apiFetch<{ tier: Tier; token: string }>("/verify-code", {
    method: "POST",
    body: JSON.stringify({ code }),
  }, true);

  if (res.data?.tier) {
    const state = loadAuthState();
    state.tier = res.data.tier;
    if (res.data.token) state.authToken = res.data.token;
    saveAuthState(state);
  }

  return res;
}

// ─────────────────────────────────────────────
// Vérification si connecté (token présent)
// ─────────────────────────────────────────────
export function isAuthenticated(): boolean {
  const state = loadAuthState();
  return !!(state.email && state.authToken);
}
