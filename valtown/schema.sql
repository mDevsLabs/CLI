-- ============================================================
-- mAI CLI — Schéma PostgreSQL
-- Coller dans Neon Console > SQL Editor
-- ============================================================

-- Extension pour UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────
-- Table : users
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        UNIQUE NOT NULL,
  password_hash TEXT        NOT NULL,
  username      TEXT,
  tier          TEXT        NOT NULL DEFAULT 'Free'
                            CHECK (tier IN ('Free', 'Plus', 'Pro', 'Max')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ─────────────────────────────────────────────
-- Table : usage_logs
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usage_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type TEXT        NOT NULL,
  metadata    JSONB,
  tokens_used INTEGER     NOT NULL DEFAULT 0,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id   ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_timestamp ON usage_logs(timestamp DESC);

-- ─────────────────────────────────────────────
-- Table : weekly_usage
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS weekly_usage (
  user_id     UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start  DATE    NOT NULL,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_usage_user_id ON weekly_usage(user_id);

-- ─────────────────────────────────────────────
-- Trigger : updated_at automatique
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
