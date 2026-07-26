/**
 * mAI CLI — Val Town HTTP Proxy
 * URL : https://mai-db.val.run/
 *
 * Dépendances Val Town (npm imports) :
 *   - hono (router léger)
 *   - @neondatabase/serverless (PostgreSQL sans pool persistant)
 *   - bcryptjs (hachage des mots de passe)
 *   - jose (JWT sign/verify)
 *
 * Secrets Val Town à configurer :
 *   DATABASE_URL  → Neon connection string
 *   MAI_JWT_SECRET → clé de signature JWT (min 64 chars)
 */

import { Hono } from "npm:hono@4";
import { cors } from "npm:hono/cors";
import { neon } from "npm:@neondatabase/serverless";
import bcrypt from "npm:bcryptjs";
import { SignJWT, jwtVerify } from "npm:jose";

// ─────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────
const JWT_EXPIRY = "14d";
const BCRYPT_ROUNDS = 12;
const API_URL = "https://mai-db.val.run";

function getDb() {
  const url = Deno.env.get("DATABASE_URL");
  if (!url) throw new Error("DATABASE_URL not set");
  return neon(url);
}

function getJwtSecret(): Uint8Array {
  const secret = Deno.env.get("MAI_JWT_SECRET");
  if (!secret) throw new Error("MAI_JWT_SECRET not set");
  return new TextEncoder().encode(secret);
}

// ─────────────────────────────────────────────
// Helpers JWT
// ─────────────────────────────────────────────
async function signToken(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(getJwtSecret());
}

async function verifyToken(token: string): Promise<Record<string, unknown>> {
  const { payload } = await jwtVerify(token, getJwtSecret());
  return payload as Record<string, unknown>;
}

// Extraire le JWT du header Authorization: Bearer <token>
function extractToken(req: Request): string | null {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

// ─────────────────────────────────────────────
// App Hono
// ─────────────────────────────────────────────
const app = new Hono();

// CORS — Autorise les requêtes depuis le CLI (fetch local)
app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
}));

// ─────────────────────────────────────────────
// POST /register
// Body: { email, password, username? }
// ─────────────────────────────────────────────
app.post("/register", async (c) => {
  try {
    const { email, password, username } = await c.req.json();

    if (!email || !password) {
      return c.json({ error: "Email et mot de passe requis." }, 400);
    }
    if (!email.includes("@") || email.length < 5) {
      return c.json({ error: "Email invalide." }, 400);
    }
    if (password.length < 6) {
      return c.json({ error: "Le mot de passe doit faire au moins 6 caractères." }, 400);
    }

    const sql = getDb();
    const existing = await sql`SELECT id FROM users WHERE email = ${email.toLowerCase()} LIMIT 1`;
    if (existing.length > 0) {
      return c.json({ error: "Un compte existe déjà avec cet email." }, 409);
    }

    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const result = await sql`
      INSERT INTO users (email, password_hash, username)
      VALUES (${email.toLowerCase()}, ${password_hash}, ${username || null})
      RETURNING id, email, username, tier, created_at
    `;
    const user = result[0];
    const token = await signToken({ sub: user.id, email: user.email, tier: user.tier });

    return c.json({ token, user: { id: user.id, email: user.email, username: user.username, tier: user.tier } }, 201);
  } catch (err: any) {
    console.error("[/register]", err);
    return c.json({ error: "Erreur serveur." }, 500);
  }
});

// ─────────────────────────────────────────────
// POST /login
// Body: { email, password }
// ─────────────────────────────────────────────
app.post("/login", async (c) => {
  try {
    const { email, password } = await c.req.json();

    if (!email || !password) {
      return c.json({ error: "Email et mot de passe requis." }, 400);
    }

    const sql = getDb();
    const result = await sql`
      SELECT id, email, password_hash, username, tier
      FROM users WHERE email = ${email.toLowerCase()} LIMIT 1
    `;
    if (result.length === 0) {
      return c.json({ error: "Identifiants incorrects." }, 401);
    }

    const user = result[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return c.json({ error: "Identifiants incorrects." }, 401);
    }

    const token = await signToken({ sub: user.id, email: user.email, tier: user.tier });

    // Log la connexion
    await sql`
      INSERT INTO usage_logs (user_id, action_type, metadata)
      VALUES (${user.id}, 'login', ${JSON.stringify({ ip: c.req.header("x-forwarded-for") || "unknown" })}::jsonb)
    `;

    return c.json({ token, user: { id: user.id, email: user.email, username: user.username, tier: user.tier } });
  } catch (err: any) {
    console.error("[/login]", err);
    return c.json({ error: "Erreur serveur." }, 500);
  }
});

// ─────────────────────────────────────────────
// POST /log-usage
// Header: Authorization: Bearer <token>
// Body: { tokensUsed, actionType?, metadata? }
// ─────────────────────────────────────────────
app.post("/log-usage", async (c) => {
  try {
    const token = extractToken(c.req.raw);
    if (!token) return c.json({ error: "Non authentifié." }, 401);

    const payload = await verifyToken(token);
    const userId = payload.sub as string;

    const sql = getDb();
    const userRes = await sql`SELECT tier FROM users WHERE id = ${userId} LIMIT 1`;
    const tier = userRes.length > 0 ? userRes[0].tier : "Free";

    const { tokensUsed = 0, actionType = "chat", metadata = {} } = await c.req.json();

    // Limites par tier
    const TIER_LIMITS: Record<string, number> = {
      Free: 2_000_000, Plus: 5_000_000, Pro: 7_000_000, Max: 10_000_000
    };
    const limit = TIER_LIMITS[tier] || 2_000_000;

    // Calcul week_start (dernier lundi à minuit UTC)
    const now = new Date();
    const day = now.getUTCDay() || 7;
    const weekStart = new Date(now);
    weekStart.setUTCDate(now.getUTCDate() - (day - 1));
    weekStart.setUTCHours(0, 0, 0, 0);
    const weekStartStr = weekStart.toISOString().split("T")[0];

    // Vérifier la consommation hebdomadaire actuelle
    const usageResult = await sql`
      SELECT tokens_used FROM weekly_usage
      WHERE user_id = ${userId} AND week_start = ${weekStartStr}
      LIMIT 1
    `;
    const currentUsage = usageResult[0]?.tokens_used || 0;

    if (currentUsage + tokensUsed > limit) {
      return c.json({ error: "Limite hebdomadaire atteinte.", limit, used: currentUsage }, 429);
    }

    // Upsert weekly_usage
    await sql`
      INSERT INTO weekly_usage (user_id, week_start, tokens_used)
      VALUES (${userId}, ${weekStartStr}, ${tokensUsed})
      ON CONFLICT (user_id, week_start)
      DO UPDATE SET tokens_used = weekly_usage.tokens_used + ${tokensUsed}
    `;

    // Insérer dans usage_logs
    await sql`
      INSERT INTO usage_logs (user_id, action_type, metadata, tokens_used)
      VALUES (${userId}, ${actionType}, ${JSON.stringify(metadata)}::jsonb, ${tokensUsed})
    `;

    return c.json({ success: true, weeklyUsed: currentUsage + tokensUsed, limit });
  } catch (err: any) {
    if (err.code === "ERR_JWT_EXPIRED") return c.json({ error: "Session expirée. Reconnectez-vous." }, 401);
    console.error("[/log-usage]", err);
    return c.json({ error: "Erreur serveur." }, 500);
  }
});

// ─────────────────────────────────────────────
// GET /usage
// Header: Authorization: Bearer <token>
// ─────────────────────────────────────────────
app.get("/usage", async (c) => {
  try {
    const token = extractToken(c.req.raw);
    if (!token) return c.json({ error: "Non authentifié." }, 401);

    const payload = await verifyToken(token);
    const userId = payload.sub as string;

    const now = new Date();
    const day = now.getUTCDay() || 7;
    const weekStart = new Date(now);
    weekStart.setUTCDate(now.getUTCDate() - (day - 1));
    weekStart.setUTCHours(0, 0, 0, 0);
    const weekStartStr = weekStart.toISOString().split("T")[0];

    const sql = getDb();

    // Usage hebdo + infos user
    const [usageResult, userResult] = await Promise.all([
      sql`SELECT tokens_used FROM weekly_usage WHERE user_id = ${userId} AND week_start = ${weekStartStr}`,
      sql`SELECT tier, email, username FROM users WHERE id = ${userId} LIMIT 1`
    ]);

    const user = userResult[0];
    const tokensUsed = usageResult[0]?.tokens_used || 0;

    const TIER_LIMITS: Record<string, number> = {
      Free: 2_000_000, Plus: 5_000_000, Pro: 7_000_000, Max: 10_000_000
    };
    const limit = TIER_LIMITS[user?.tier] || 2_000_000;

    return c.json({
      tier: user?.tier || "Free",
      email: user?.email,
      username: user?.username,
      tokensUsed,
      limit,
      weekStart: weekStartStr,
    });
  } catch (err: any) {
    if (err.code === "ERR_JWT_EXPIRED") return c.json({ error: "Session expirée." }, 401);
    console.error("[/usage]", err);
    return c.json({ error: "Erreur serveur." }, 500);
  }
});

// ─────────────────────────────────────────────
// POST /update-profile
// Header: Authorization: Bearer <token>
// Body: { username?, email?, currentPassword, newPassword? }
// ─────────────────────────────────────────────
app.post("/update-profile", async (c) => {
  try {
    const token = extractToken(c.req.raw);
    if (!token) return c.json({ error: "Non authentifié." }, 401);

    const payload = await verifyToken(token);
    const userId = payload.sub as string;

    const { username, email, currentPassword, newPassword } = await c.req.json();

    if (!currentPassword) return c.json({ error: "Mot de passe actuel requis." }, 400);

    const sql = getDb();
    const result = await sql`SELECT password_hash, tier FROM users WHERE id = ${userId} LIMIT 1`;
    if (result.length === 0) return c.json({ error: "Utilisateur introuvable." }, 404);

    const user = result[0];
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return c.json({ error: "Mot de passe actuel incorrect." }, 401);

    // Construire les mises à jour
    const updates: Record<string, unknown> = {};
    if (username !== undefined) updates.username = username;
    if (email !== undefined) {
      if (!email.includes("@")) return c.json({ error: "Email invalide." }, 400);
      // Vérifier unicité
      const taken = await sql`SELECT id FROM users WHERE email = ${email.toLowerCase()} AND id != ${userId}`;
      if (taken.length > 0) return c.json({ error: "Cet email est déjà utilisé." }, 409);
      updates.email = email.toLowerCase();
    }
    if (newPassword) {
      if (newPassword.length < 6) return c.json({ error: "Nouveau mot de passe trop court." }, 400);
      updates.password_hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    }

    if (Object.keys(updates).length === 0) return c.json({ error: "Aucune modification." }, 400);

    // Mise à jour dynamique
    const setClauses = Object.entries(updates).map(([k, v]) => `${k} = '${String(v).replace(/'/g, "''")}'`).join(", ");
    await sql`UPDATE users SET updated_at = NOW() WHERE id = ${userId}`;
    for (const [k, v] of Object.entries(updates)) {
      if (k === "username") await sql`UPDATE users SET username = ${v as string} WHERE id = ${userId}`;
      if (k === "email") await sql`UPDATE users SET email = ${v as string} WHERE id = ${userId}`;
      if (k === "password_hash") await sql`UPDATE users SET password_hash = ${v as string} WHERE id = ${userId}`;
    }

    // Nouveau token avec données à jour
    const updatedUser = await sql`SELECT email, username, tier FROM users WHERE id = ${userId} LIMIT 1`;
    const newToken = await signToken({ sub: userId, email: updatedUser[0].email, tier: updatedUser[0].tier });

    return c.json({
      token: newToken,
      user: { email: updatedUser[0].email, username: updatedUser[0].username, tier: updatedUser[0].tier }
    });
  } catch (err: any) {
    if (err.code === "ERR_JWT_EXPIRED") return c.json({ error: "Session expirée." }, 401);
    console.error("[/update-profile]", err);
    return c.json({ error: "Erreur serveur." }, 500);
  }
});

// ─────────────────────────────────────────────
// POST /verify-code (upgrade forfait)
// Body: { code }
// Header: Authorization: Bearer <token>
// ─────────────────────────────────────────────
app.post("/verify-code", async (c) => {
  try {
    const token = extractToken(c.req.raw);
    if (!token) return c.json({ error: "Non authentifié." }, 401);

    const payload = await verifyToken(token);
    const userId = payload.sub as string;

    const { code } = await c.req.json();
    if (!code) return c.json({ error: "Code requis." }, 400);

    let newTier = "";
    if (code === Deno.env.get("PLUS_MAI_CODE")) newTier = "Plus";
    else if (code === Deno.env.get("PRO_MAI_CODE")) newTier = "Pro";
    else if (code === Deno.env.get("MAX_MAI_CODE")) newTier = "Max";

    if (!newTier) {
      return c.json({ error: "Code invalide." }, 400);
    }

    const sql = getDb();
    await sql`UPDATE users SET tier = ${newTier} WHERE id = ${userId}`;

    const updatedUser = await sql`SELECT email, tier FROM users WHERE id = ${userId} LIMIT 1`;
    const newToken = await signToken({ sub: userId, email: updatedUser[0].email, tier: newTier });

    return c.json({ tier: newTier, token: newToken });
  } catch (err: any) {
    if (err.code === "ERR_JWT_EXPIRED") return c.json({ error: "Session expirée." }, 401);
    console.error("[/verify-code]", err);
    return c.json({ error: "Erreur serveur." }, 500);
  }
});

// ─────────────────────────────────────────────
// POST /chat/completions (Proxy IA)
// Header: Authorization: Bearer <token>
// ─────────────────────────────────────────────
app.post("/chat/completions", async (c) => {
  try {
    const token = extractToken(c.req.raw);
    if (!token) return c.json({ error: "Non authentifié." }, 401);

    const payload = await verifyToken(token);
    const userId = payload.sub as string;

    const sql = getDb();
    const userRes = await sql`SELECT tier FROM users WHERE id = ${userId} LIMIT 1`;
    const tier = userRes.length > 0 ? userRes[0].tier : "Free";

    // Vérifier si la limite hebdomadaire est déjà atteinte
    const TIER_LIMITS: Record<string, number> = {
      Free: 2_000_000, Plus: 5_000_000, Pro: 7_000_000, Max: 10_000_000
    };
    const limit = TIER_LIMITS[tier] || 2_000_000;

    const now = new Date();
    const day = now.getUTCDay() || 7;
    const weekStart = new Date(now);
    weekStart.setUTCDate(now.getUTCDate() - (day - 1));
    weekStart.setUTCHours(0, 0, 0, 0);
    const weekStartStr = weekStart.toISOString().split("T")[0];

    const usageResult = await sql`
      SELECT tokens_used FROM weekly_usage
      WHERE user_id = ${userId} AND week_start = ${weekStartStr}
      LIMIT 1
    `;
    const currentUsage = usageResult[0]?.tokens_used || 0;

    if (currentUsage >= limit) {
      return c.json({ error: `Limite hebdomadaire atteinte (${limit} tokens). Passez au forfait supérieur.` }, 429);
    }

    const body = await c.req.json();
    
    // Optionnel : sécuriser l'accès aux modèles payants si tier === "Free"
    // (à faire ici si vous souhaitez bloquer certains modèles côté serveur)

    const apiKey = Deno.env.get("MAI_API_KEY");
    if (!apiKey) {
      return c.json({ error: "MAI_API_KEY non configurée sur le serveur." }, 500);
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://github.com/mDevsLabs/mAI-CLI",
        "X-Title": "mAI CLI",
      },
      body: JSON.stringify(body),
    });

    // Retourner le flux OpenRouter directement
    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (err: any) {
    if (err.code === "ERR_JWT_EXPIRED") return c.json({ error: "Session expirée." }, 401);
    console.error("[/chat/completions]", err);
    return c.json({ error: "Erreur serveur proxy." }, 500);
  }
});

// ─────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────
app.get("/", (c) => c.json({ status: "ok", service: "mAI CLI API", version: "1.0.0" }));

export default app.fetch;
