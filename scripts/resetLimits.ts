/**
 * resetLimits.ts
 * 
 * Script pour se connecter à la base de données PostgreSQL (via DATABASE_URL ou variables .env)
 * afin de remettre à 0% d'utilisation les limites /usage de TOUS les utilisateurs.
 * 
 * Ce script :
 * 1. Charge les variables d'environnement (.env) de manière robuste.
 * 2. Se connecte à la base de données PostgreSQL.
 * 3. Assure la présence de la table de suivi des resets (mai_user_resets) et des colonnes requises.
 * 4. Compte le nombre total d'utilisateurs enregistrés dans la table 'users'.
 * 5. Remet à 0% d'utilisation le taux d'usage (tokens_used = 0, mai_credits = plan max, alert = 'reset')
 *    pour tous les utilisateurs et enregistre l'historique des réinitialisations.
 * 
 * Exécution :
 * bun reset
 * ou
 * bun scripts/resetLimits.ts
 */

import { join } from "node:path";
import { existsSync } from "node:fs";
import pg from "pg";
import * as dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";

// Chargement robuste des fichiers .env à partir du répertoire de travail
const rootEnv = join(process.cwd(), ".env");
if (existsSync(rootEnv)) {
  dotenvExpand.expand(dotenv.config({ path: rootEnv }));
}

const env = process.env.NODE_ENV || "development";
const envPath = join(process.cwd(), `.env.${env}`);
if (existsSync(envPath)) {
  dotenvExpand.expand(dotenv.config({ override: true, path: envPath }));
}

const envLocalPath = join(process.cwd(), `.env.${env}.local`);
if (existsSync(envLocalPath)) {
  dotenvExpand.expand(dotenv.config({ override: true, path: envLocalPath }));
}

const PLAN_CREDITS: Record<string, number> = {
  Free: 2000000,
  Plus: 5000000,
  Pro: 7000000,
  Max: 10000000,
};

const ensureSchema = async (client: pg.PoolClient) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS mai_user_resets (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reset_type varchar(50) NOT NULL,
      name varchar(255),
      status varchar(50) DEFAULT 'active' NOT NULL,
      credits_amount integer,
      is_add boolean DEFAULT false,
      expires_at timestamp with time zone,
      activated_at timestamp with time zone,
      created_at timestamp with time zone DEFAULT now() NOT NULL
    );
    ALTER TABLE users ADD COLUMN IF NOT EXISTS tier text DEFAULT 'Free';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS mai_plan text DEFAULT 'Free';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS mai_credits integer;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS mai_credits_alert text;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS tokens_used bigint DEFAULT 0;
  `);
};

export async function resetLimits() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("[ERROR] DATABASE_URL parameter is missing in environment variables.");
    process.exit(1);
  }

  // Reset local cache to ensure the CLI updates immediately if unauthenticated
  try {
    const { loadAuthState, saveAuthState } = await import("../src/services/authStore.js");
    const state = loadAuthState();
    state.tokensUsed = 0;
    saveAuthState(state);
    console.log("[INFO] Local authentication state (tokensUsed) has been reset to 0.");
  } catch (err) {
    console.log("[WARN] Could not reset local authentication state:", err);
  }

  const pool = new pg.Pool({ connectionString: dbUrl });
  const client = pool ? await pool.connect() : null;

  if (!client) {
    console.error("[ERROR] Could not connect to PostgreSQL database.");
    process.exit(1);
  }

  try {
    console.log("=== mAI Limits Reset Script ===");
    console.log("Connecting to PostgreSQL database...");

    await ensureSchema(client);

    // 1. Count total users
    const countResult = await client.query("SELECT COUNT(*) AS total FROM users");
    const totalUsers = parseInt(countResult.rows[0]?.total || "0", 10);

    console.log(`[INFO] Found ${totalUsers} user(s) in database.`);

    if (totalUsers === 0) {
      console.log("[INFO] No users found to reset.");
      return;
    }

    // Fetch user details safely checking for mai_plan or tier column
    const { rows: users } = await client.query(
      "SELECT id, email, COALESCE(mai_plan, tier, 'Free') AS plan FROM users"
    );

    let updatedCount = 0;
    const batchSize = 100;
    const now = new Date();

    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);

      await client.query("BEGIN");
      try {
        for (const user of batch) {
          const plan = user.plan || "Free";
          const maxCredits = PLAN_CREDITS[plan] || PLAN_CREDITS["Free"];

          // Reset usage to 0% (tokens_used = 0 and mai_credits restored to plan default)
          await client.query(
            `UPDATE users 
             SET mai_credits = $1, 
                 tokens_used = 0, 
                 mai_credits_alert = 'reset' 
             WHERE id = $2`,
            [maxCredits, user.id]
          );

          // Reset Val Town's weekly usage tracking
          await client.query(
            `UPDATE weekly_usage
             SET tokens_used = 0
             WHERE user_id = $1`,
            [user.id]
          );

          // Insert reset record in audit log
          await client.query(
            `INSERT INTO mai_user_resets 
              (id, user_id, reset_type, name, status, credits_amount, is_add, activated_at, created_at) 
             VALUES 
              (gen_random_uuid(), $1, 'global_usage_reset', 'Reset usage to 0%', 'active', $2, false, $3, $3)`,
            [user.id, maxCredits, now]
          );
        }
        await client.query("COMMIT");
        updatedCount += batch.length;
        console.log(`[PROGRESS] Processed ${updatedCount}/${totalUsers} user(s)...`);
      } catch (txErr) {
        await client.query("ROLLBACK");
        console.error(`[ERROR] Transaction failed for batch starting at index ${i}:`, txErr);
        throw txErr;
      }
    }

    console.log("=========================================");
    console.log(`[SUCCESS] Reset complete! Successfully reset usage to 0% for all ${updatedCount} user(s).`);
    console.log("=========================================");
  } catch (error) {
    console.error("[FATAL ERROR] Failed to reset limits:", error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1] && process.argv[1].endsWith("resetLimits.ts")) {
  resetLimits();
}
