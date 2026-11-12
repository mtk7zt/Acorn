# Database Migration Guide: Migration 0003

**Migration Name:** `0003_user_profiles_and_portability.sql`  
**Milestone:** `BETA-02`  
**Compatibility:** Fully additive; zero breaking changes to existing tables or BETA-01 grants.

---

## 1. Summary of Changes
Migration 0003 adds 7 new tables to support canonical identities, profiles, roles, and portable storage:
1. `acorn_users`
2. `user_external_identities`
3. `user_profiles`
4. `user_target_roles`
5. `user_search_preferences`
6. `user_resume_assets`
7. `user_scan_requests`

---

## 2. Remote Cloudflare D1 Execution
Run from `cloudflare-worker/`:
```powershell
npx wrangler d1 execute acorn-production-db --remote --file=../migrations/0003_user_profiles_and_portability.sql
```

## 3. Local SQLite Verification
Executed automatically via `pytest tests/test_user_profiles.py` against in-memory SQLite engines during test runs.
