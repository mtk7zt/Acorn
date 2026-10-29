-- Rollback Migration 0002 — Beta Activation Keys & Access Grants
-- Target: Cloudflare D1 / SQLite 3
-- Preserves existing users, sessions, invitations, and audit logs.

DROP INDEX IF EXISTS idx_activation_audit_created;
DROP INDEX IF EXISTS idx_user_access_grants_tg_status;
DROP INDEX IF EXISTS idx_activation_redemptions_user;
DROP INDEX IF EXISTS idx_activation_keys_revoked;
DROP INDEX IF EXISTS idx_activation_keys_hash;

DROP TABLE IF EXISTS activation_audit_events;
DROP TABLE IF EXISTS user_access_grants;
DROP TABLE IF EXISTS activation_redemptions;
DROP TABLE IF EXISTS activation_keys;
