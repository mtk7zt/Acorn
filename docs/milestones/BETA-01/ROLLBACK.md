# Acorn AI — Milestone BETA-01 Rollback & Feature Disablement Guide
**Document:** `docs/milestones/BETA-01/ROLLBACK.md`  
**Milestone:** `BETA-01 — Controlled Beta Testing & Activation`  
**Status:** Approved  

---

## 1. Non-Destructive Emergency Disablement

If activation key redemption must be paused immediately without deploying code or dropping tables:

### Procedure
1. The founder can revoke active keys directly via Telegram:
   ```text
   /revoke_key <key_id>
   ```
2. Or disable all pending keys in Cloudflare D1:
   ```sql
   UPDATE activation_keys SET revoked_at = datetime('now'), revoked_by = 'emergency_pause' WHERE revoked_at IS NULL;
   ```
3. **Safety Guarantee**: Existing authorized testers retain their access; unauthorized users cannot redeem new keys. The bot **never falls open to the public**.

---

## 2. Full Codebase Rollback (If Required)

If the edge worker code must be reverted to pre-BETA-01 state:
1. Revert Git commit:
   ```bash
   git revert <commit_hash>
   ```
2. The Central Authorization Guard will revert to the legacy static `ALLOWED_CHAT_IDS` mechanism.
3. Apply SQL rollback if database cleanup is desired:
   ```bash
   npx wrangler d1 execute acorn-production-db --file=../migrations/0002_rollback.sql
   ```
4. Deploy worker:
   ```bash
   npx wrangler deploy
   ```
