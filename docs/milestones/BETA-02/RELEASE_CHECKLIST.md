# Founder Release Checklist for BETA-02

**Milestone:** `BETA-02 — Personalized Profiles, Scan Isolation & Portable Data Architecture`  
**Execution Authority:** Founder (Manual / Controlled)  
**Production Deployment:** Unexecuted in Turbo Mode (Ready for Founder Activation)  

---

## 1. Pre-Deployment Verification

- [x] All 61 automated tests pass cleanly (`pytest tests/ -v`).
- [x] Working tree clean; all changes committed to `dev`.
- [x] Zero sensitive data present in `data/runtime/` or codebase.
- [x] Cloudflare Worker ESM import verified with zero syntax warnings.

---

## 2. Founder Deployment Execution Steps

When you are ready to roll out Milestone BETA-02 to production, run the following commands:

### Step 1: Execute D1 Migration 0003
```powershell
cd cloudflare-worker
npx wrangler d1 execute acorn-production-db --remote --file=../migrations/0003_user_profiles_and_portability.sql
```

### Step 2: Deploy Cloudflare Edge Worker
```powershell
npx wrangler deploy
```

### Step 3: Production Telegram Smoke Test
1. Send `/start` as a tester.
2. Tap **`[👤 My Profile & Roles]`** or type `/profile` to view your initialized career profile.
3. Type `/setroles Junior Cloud Engineer, Data Analyst` and verify your roles update.
4. Type `/setlocations Toronto, Remote` and verify your locations update.
5. Type `/scan` and verify that the scan triggers for your roles and delivers results **only to your chat** (with 0 notifications reaching the founder).
6. Type `/exportprofile` to inspect your portable JSON profile.
