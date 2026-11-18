# Acorn Profile Schema Specification (Migration 0003)

**Migration File:** `migrations/0003_user_profiles_and_portability.sql`  
**Rollback File:** `migrations/0003_rollback.sql`  

---

## 1. Table Specifications

### `acorn_users`
Authoritative master record for all internal users.
- `id TEXT PRIMARY KEY` — Format: `usr_<uuid>`
- `status TEXT NOT NULL DEFAULT 'active'` — 'active', 'suspended', 'purged'
- `created_at TEXT NOT NULL` — ISO-8601 UTC
- `updated_at TEXT NOT NULL` — ISO-8601 UTC

### `user_external_identities`
Maps external transport channels to canonical users.
- `id TEXT PRIMARY KEY` — UUID
- `acorn_user_id TEXT NOT NULL REFERENCES acorn_users(id)`
- `provider TEXT NOT NULL` — 'telegram', 'web', 'mobile'
- `provider_user_id TEXT NOT NULL` — Numeric Telegram chat/user ID
- `verified_at TEXT NOT NULL`
- `created_at TEXT NOT NULL`
- Constraint: `UNIQUE(provider, provider_user_id)`

### `user_profiles`
Core career metadata and onboarding lifecycle.
- `id TEXT PRIMARY KEY` — UUID
- `acorn_user_id TEXT NOT NULL UNIQUE REFERENCES acorn_users(id)`
- `career_stage TEXT NOT NULL DEFAULT 'mid'` — 'early', 'mid', 'senior', 'lead', 'executive'
- `experience_level TEXT NOT NULL DEFAULT 'mid'`
- `onboarding_status TEXT NOT NULL DEFAULT 'pending'` — 'pending', 'completed'
- `schema_version TEXT NOT NULL DEFAULT '1.0'`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

### `user_target_roles`
Per-user prioritized target job titles.
- `id TEXT PRIMARY KEY` — UUID
- `acorn_user_id TEXT NOT NULL REFERENCES acorn_users(id)`
- `role_title TEXT NOT NULL` — Verbatim title (e.g. "Junior DevOps Engineer")
- `normalized_role TEXT NOT NULL` — Lowercase canonical representation
- `priority INTEGER NOT NULL DEFAULT 1`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

### `user_search_preferences`
Geographic and working arrangement preferences.
- `id TEXT PRIMARY KEY` — UUID
- `acorn_user_id TEXT NOT NULL UNIQUE REFERENCES acorn_users(id)`
- `preferred_locations TEXT NOT NULL DEFAULT '["Toronto", "Remote"]'` (JSON Array)
- `work_arrangement TEXT NOT NULL DEFAULT 'any'` — 'remote', 'hybrid', 'onsite', 'any'
- `seniority TEXT NOT NULL DEFAULT 'any'` — 'junior', 'mid', 'senior', 'any'
- `employment_types TEXT NOT NULL DEFAULT '["full_time"]'` (JSON Array)
- `min_salary REAL DEFAULT 0`
- `skills TEXT NOT NULL DEFAULT '[]'` (JSON Array)
- `notification_cadence TEXT NOT NULL DEFAULT 'instant'` — 'instant', 'daily_briefing', 'muted'
- `timezone TEXT NOT NULL DEFAULT 'America/Toronto'`

### `user_resume_assets`
Provider-neutral document metadata.
- `id TEXT PRIMARY KEY` — Format: `res_<uuid>`
- `acorn_user_id TEXT NOT NULL REFERENCES acorn_users(id)`
- `storage_provider TEXT NOT NULL DEFAULT 'local'` — 'local', 'r2', 's3'
- `storage_key TEXT NOT NULL`
- `content_type TEXT NOT NULL` — MIME type
- `file_size INTEGER NOT NULL` — Bytes
- `checksum TEXT NOT NULL` — SHA-256 hex digest
- `security_status TEXT NOT NULL DEFAULT 'quarantined'` — 'quarantined', 'verified', 'rejected'
- `deleted_at TEXT` — Soft delete timestamp

### `user_scan_requests`
Audit records ensuring scan requests remain bound to their owner.
- `id TEXT PRIMARY KEY` — Format: `scn_<uuid>`
- `acorn_user_id TEXT NOT NULL REFERENCES acorn_users(id)`
- `status TEXT NOT NULL DEFAULT 'pending'` — 'pending', 'running', 'completed', 'failed'
- `preferences_version INTEGER NOT NULL DEFAULT 1`
- `correlation_id TEXT NOT NULL`
- `recipient_channel TEXT NOT NULL DEFAULT 'telegram'`
- `recipient_address TEXT NOT NULL` — Recipient chat ID
- `requested_at TEXT NOT NULL`
- `completed_at TEXT`
