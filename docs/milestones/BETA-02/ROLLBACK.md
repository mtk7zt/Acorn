# Safe Rollback Procedure: Milestone BETA-02

**Rollback Script:** `migrations/0003_rollback.sql`  
**Purpose:** Revert all schema changes introduced in BETA-02 without corrupting prior migrations (0001, 0002) or BETA-01 activation records.

---

## 1. Database Rollback

To drop all BETA-02 profile and scan tables from Cloudflare D1:
```powershell
cd cloudflare-worker
npx wrangler d1 execute acorn-production-db --remote --file=../migrations/0003_rollback.sql
```

## 2. Worker Code Rollback
To revert the Cloudflare Worker to the pre-BETA-02 commit (`31b8f4b`):
```powershell
git checkout 31b8f4b -- cloudflare-worker/
cd cloudflare-worker
npx wrangler deploy
```

BETA-01 activation keys, user access grants, and audit events will remain completely intact.
