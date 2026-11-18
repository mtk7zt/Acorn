-- ============================================================================
-- Acorn AI Migration 0003 Rollback
-- Drops all tables introduced in 0003_user_profiles_and_portability.sql
-- ============================================================================

DROP TABLE IF EXISTS user_scan_requests;
DROP TABLE IF EXISTS user_resume_assets;
DROP TABLE IF EXISTS user_search_preferences;
DROP TABLE IF EXISTS user_target_roles;
DROP TABLE IF EXISTS user_profiles;
DROP TABLE IF EXISTS user_external_identities;
DROP TABLE IF EXISTS acorn_users;
