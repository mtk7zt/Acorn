-- ============================================================================
-- Acorn AI Database Migration 0003: User Profiles, Isolation & Portability
-- Milestone: BETA-02 — Personalized User Profiles & Portable Data Architecture
-- Engine: Cloudflare D1 (SQLite Dialect) / Local SQLite (WAL Mode)
-- ============================================================================

-- 1. Canonical Acorn Users
CREATE TABLE IF NOT EXISTS acorn_users (
    id TEXT PRIMARY KEY,                       -- Format: usr_<uuid>
    status TEXT NOT NULL DEFAULT 'active',      -- 'active', 'suspended', 'purged'
    created_at TEXT NOT NULL,                  -- ISO-8601 UTC
    updated_at TEXT NOT NULL                   -- ISO-8601 UTC
);

CREATE INDEX IF NOT EXISTS idx_acorn_users_status ON acorn_users(status);

-- 2. External Identity Bindings (e.g. Telegram, Future Web/Mobile)
CREATE TABLE IF NOT EXISTS user_external_identities (
    id TEXT PRIMARY KEY,                       -- UUID
    acorn_user_id TEXT NOT NULL REFERENCES acorn_users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,                    -- 'telegram', 'web', 'mobile'
    provider_user_id TEXT NOT NULL,            -- e.g. Numeric Telegram Chat/User ID string
    verified_at TEXT NOT NULL,                 -- ISO-8601 UTC
    created_at TEXT NOT NULL,                  -- ISO-8601 UTC
    UNIQUE(provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_external_identities_lookup 
ON user_external_identities(provider, provider_user_id);

CREATE INDEX IF NOT EXISTS idx_external_identities_user 
ON user_external_identities(acorn_user_id);

-- 3. Career Profiles & Onboarding State
CREATE TABLE IF NOT EXISTS user_profiles (
    id TEXT PRIMARY KEY,                       -- UUID
    acorn_user_id TEXT NOT NULL UNIQUE REFERENCES acorn_users(id) ON DELETE CASCADE,
    career_stage TEXT NOT NULL DEFAULT 'mid',  -- 'early', 'mid', 'senior', 'lead', 'executive'
    experience_level TEXT NOT NULL DEFAULT 'mid',
    onboarding_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed'
    schema_version TEXT NOT NULL DEFAULT '1.0',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 4. Per-User Target Roles
CREATE TABLE IF NOT EXISTS user_target_roles (
    id TEXT PRIMARY KEY,                       -- UUID
    acorn_user_id TEXT NOT NULL REFERENCES acorn_users(id) ON DELETE CASCADE,
    role_title TEXT NOT NULL,                  -- Original verbatim title (e.g. "Full Stack Developer")
    normalized_role TEXT NOT NULL,              -- Lowercase / canonical token
    priority INTEGER NOT NULL DEFAULT 1,       -- 1 = high, 2 = standard
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_target_roles_user 
ON user_target_roles(acorn_user_id);

CREATE INDEX IF NOT EXISTS idx_user_target_roles_normalized 
ON user_target_roles(normalized_role);

-- 5. Search Preferences (Locations, Arrangements, Seniority)
CREATE TABLE IF NOT EXISTS user_search_preferences (
    id TEXT PRIMARY KEY,                       -- UUID
    acorn_user_id TEXT NOT NULL UNIQUE REFERENCES acorn_users(id) ON DELETE CASCADE,
    preferred_locations TEXT NOT NULL DEFAULT '["Toronto", "Remote"]', -- JSON Array
    work_arrangement TEXT NOT NULL DEFAULT 'any',                      -- 'remote', 'hybrid', 'onsite', 'any'
    seniority TEXT NOT NULL DEFAULT 'any',                             -- 'junior', 'mid', 'senior', 'any'
    employment_types TEXT NOT NULL DEFAULT '["full_time"]',            -- JSON Array
    min_salary REAL DEFAULT 0,
    skills TEXT NOT NULL DEFAULT '[]',                                 -- JSON Array
    notification_cadence TEXT NOT NULL DEFAULT 'instant',              -- 'instant', 'daily_briefing', 'muted'
    timezone TEXT NOT NULL DEFAULT 'America/Toronto',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 6. User Resume Assets (Provider-Agnostic Storage Metadata)
CREATE TABLE IF NOT EXISTS user_resume_assets (
    id TEXT PRIMARY KEY,                       -- Format: res_<uuid>
    acorn_user_id TEXT NOT NULL REFERENCES acorn_users(id) ON DELETE CASCADE,
    storage_provider TEXT NOT NULL DEFAULT 'local', -- 'local', 'r2', 's3'
    storage_key TEXT NOT NULL,                 -- Neutral path / object key
    content_type TEXT NOT NULL,                -- 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    file_size INTEGER NOT NULL,                -- Bytes
    checksum TEXT NOT NULL,                    -- SHA-256 hex digest
    security_status TEXT NOT NULL DEFAULT 'quarantined', -- 'quarantined', 'verified', 'rejected'
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT                            -- Soft delete
);

CREATE INDEX IF NOT EXISTS idx_resume_assets_user 
ON user_resume_assets(acorn_user_id);

-- 7. User-Owned Scan Requests (Prevents Cross-User Notification Delivery)
CREATE TABLE IF NOT EXISTS user_scan_requests (
    id TEXT PRIMARY KEY,                       -- Format: scn_<uuid>
    acorn_user_id TEXT NOT NULL REFERENCES acorn_users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',    -- 'pending', 'running', 'completed', 'failed'
    preferences_version INTEGER NOT NULL DEFAULT 1,
    correlation_id TEXT NOT NULL,
    recipient_channel TEXT NOT NULL DEFAULT 'telegram',
    recipient_address TEXT NOT NULL,           -- Verified destination (e.g. Chat ID)
    matched_opportunities_count INTEGER DEFAULT 0,
    requested_at TEXT NOT NULL,
    completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_scan_requests_user 
ON user_scan_requests(acorn_user_id);

CREATE INDEX IF NOT EXISTS idx_scan_requests_status 
ON user_scan_requests(status);
