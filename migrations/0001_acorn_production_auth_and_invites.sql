-- Acorn AI Production Schema Migration (Forward-Compatible)
-- Target: Cloudflare D1 / SQLite 3

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('founder', 'member')) DEFAULT 'member',
  telegram_chat_id TEXT UNIQUE,
  telegram_handle TEXT,
  telegram_linked_at TEXT,
  preferences_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  session_id_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS access_requests (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  career_stage TEXT NOT NULL,
  role_interest TEXT NOT NULL DEFAULT '',
  preferred_locations TEXT NOT NULL DEFAULT 'Canada',
  goals_context TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'declined')) DEFAULT 'pending',
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  recipient_email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('founder', 'member')) DEFAULT 'member',
  key_preview TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE, -- SHA-256 hex digest; raw key is never persisted
  status TEXT NOT NULL CHECK (status IN ('active', 'redeemed', 'revoked', 'expired')) DEFAULT 'active',
  expires_at TEXT NOT NULL,
  redeemed_by_user_id TEXT REFERENCES users(id),
  redeemed_at TEXT,
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS telegram_link_tokens (
  token_hash TEXT PRIMARY KEY, -- SHA-256 of single-use acrn_tg_... token
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS user_signals (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  signal_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('unread', 'saved', 'dismissed', 'reviewed')) DEFAULT 'unread',
  signal_payload_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (user_id, signal_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_invitations_token_hash ON invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status);
CREATE INDEX IF NOT EXISTS idx_user_signals_user_status ON user_signals(user_id, status);
