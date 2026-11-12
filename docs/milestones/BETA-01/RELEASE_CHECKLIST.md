# Acorn AI — Milestone BETA-01 Release Checklist & Operational Gates
**Document:** `docs/milestones/BETA-01/RELEASE_CHECKLIST.md`  
**Milestone:** `BETA-01 — Controlled Beta Testing & Activation`  
**Status:** Verification Ready (Pre-Deployment)  

---

## Pre-Release Verification Gates

- [x] **Repository Baseline Established**: Dev branch synchronized with `main`.
- [x] **Additive Migration Created**: `migrations/0002_acorn_beta_activation_keys.sql` validated on SQLite engine.
- [x] **Rollback Migration Verified**: `migrations/0002_rollback.sql` tested non-destructively.
- [x] **Zero-Trust Central Authorization Guard**: `cloudflare-worker/activation/auth.js` implemented and integrated.
- [x] **Cryptographic Token Generator**: Web Crypto 256-bit entropy tested in Node ESM.
- [x] **Atomic Capacity Enforcement**: Conditional SQL updates prevent oversubscription under concurrency.
- [x] **Founder Administrative Commands**: `/admin`, `/newkey`, `/keys`, `/testers`, `/revoke_*` implemented.
- [x] **Warm Public Onboarding**: `/start` renders welcoming greeting and activation buttons for unauthenticated users.
- [x] **Automated Test Coverage**: 44 passing unit, integration, security, and concurrency tests.
- [x] **Zero Hardcoded Secrets**: Scanned source files; no credentials committed.

---

## Production Deployment Checklist (For Founder Execution Only)

When the founder decides to deploy BETA-01 to production:

1. **Configure Production Secrets in Cloudflare Wrangler**:
   ```bash
   cd cloudflare-worker
   npx wrangler secret put ACORN_FOUNDER_TELEGRAM_ID
   npx wrangler secret put ACTIVATION_PEPPER
   ```
2. **Apply Additive Schema Migration to Cloudflare D1 Database**:
   ```bash
   npx wrangler d1 execute acorn-production-db --file=../migrations/0002_acorn_beta_activation_keys.sql
   ```
3. **Deploy Edge Worker**:
   ```bash
   npx wrangler deploy
   ```
4. **Smoke Test in Telegram**:
   - Send `/start` from founder Telegram account -> Verify full bot control hub appears.
   - Send `/newkey "Initial Tester" 1` -> Verify key generated once.
   - Send `/start` from a secondary tester Telegram account -> Verify public onboarding appears.
   - Enter activation key -> Verify `"🌱 You're in!"` welcome and access grant.
   - Send `/testers` from founder account -> Verify 1 active tester reported.
