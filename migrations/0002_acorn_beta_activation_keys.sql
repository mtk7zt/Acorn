-- Acorn AI Migration 0002 — Beta Activation Keys & Access Grants
-- Target: Cloudflare D1 / SQLite 3
-- Additive only: Does not drop, alter, or destroy existing tables.

-- 1. Activation Keys
CREATE TABLE IF NOT EXISTS activation_keys (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE, -- HMAC-SHA256 hex digest
  key_purpose TEXT NOT NULL DEFAULT 'beta_tester',
  max_redemptions INTEGER NOT NULL CHECK (max_redemptions > 0 AND max_redemptions <= 1000) DEFAULT 1,
  redemption_count INTEGER NOT NULL CHECK (redemption_count >= 0) DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  redeem_expires_at TEXT,
  access_expires_at TEXT,
  revoked_at TEXT,
  revoked_by TEXT
);

-- 2. Activation Redemptions
CREATE TABLE IF NOT EXISTS activation_redemptions (
  id TEXT PRIMARY KEY,
  activation_key_id TEXT NOT NULL REFERENCES activation_keys(id) ON DELETE RESTRICT,
  telegram_user_id TEXT NOT NULL,
  user_id TEXT,
  redeemed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  CONSTRAINT uq_key_telegram_user UNIQUE(activation_key_id, telegram_user_id)
);

-- 3. User Access Grants
CREATE TABLE IF NOT EXISTS user_access_grants (
  id TEXT PRIMARY KEY,
  telegram_user_id TEXT NOT NULL UNIQUE,
  user_id TEXT,
  role TEXT NOT NULL CHECK (role IN ('tester', 'founder', 'vip')) DEFAULT 'tester',
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked', 'expired')) DEFAULT 'active',
  grant_source TEXT NOT NULL CHECK (grant_source IN ('activation_key', 'founder_direct', 'legacy_allowlist')),
  activation_key_id TEXT REFERENCES activation_keys(id),
  granted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  expires_at TEXT,
  revoked_at TEXT,
  revoked_by TEXT
);

-- 4. Activation Audit Events
CREATE TABLE IF NOT EXISTS activation_audit_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'KEY_CREATED', 'KEY_REVOKED', 'KEY_REDEEMED', 'ACCESS_GRANTED', 'ACCESS_REVOKED', 'ACCESS_RESTORED'
  )),
  actor_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  activation_key_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Indexes for sub-millisecond authorization lookup
CREATE INDEX IF NOT EXISTS idx_activation_keys_hash ON activation_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_activation_keys_revoked ON activation_keys(revoked_at);
CREATE INDEX IF NOT EXISTS idx_activation_redemptions_user ON activation_redemptions(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_user_access_grants_tg_status ON user_access_grants(telegram_user_id, status);
CREATE INDEX IF NOT EXISTS idx_activation_audit_created ON activation_audit_events(created_at);
