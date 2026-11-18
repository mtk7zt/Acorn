# Acorn AI — Milestone BETA-01 Implementation Plan
**Document:** `docs/milestones/BETA-01/IMPLEMENTATION_PLAN.md`  
**Milestone:** `BETA-01 — Controlled Beta Testing & Activation`  
**Date:** 2026-10-29  
**Status:** Approved  

---

## 1. Architectural Strategy & Modular Boundaries

The beta activation system is implemented as an **isolated, additive, and removable module** inside `cloudflare-worker/activation/`. 

```text
cloudflare-worker/
├── index.js                     <-- Plug Central Authorization Guard into fetch & processUpdate
├── activation/
│   ├── crypto.js                <-- Web Crypto 256-bit random key generator + HMAC-SHA256 verifier
│   ├── repository.js            <-- D1 SQL queries with atomic capacity enforcement
│   ├── service.js               <-- Key lifecycle (Type A single-use, Type B limited capacity)
│   ├── auth.js                  <-- Central Authorization Guard (Founder vs Tester vs Public)
│   └── admin.js                 <-- Interactive Founder Telegram commands (/newkey, /keys, /revoke_*)
└── wrangler.toml                <-- Additive D1 binding declaration
```

### Removability Contract
- If the activation module is disabled, the system can gracefully revert to static allowlist verification (`ALLOWED_CHAT_IDS`) without altering any core domain models, job harvesting, or web app features.
- Emergency disablement of key redemption will **never open the bot to the public**.

---

## 2. Additive Database Migrations (`migrations/0002_acorn_beta_activation_keys.sql`)

Four additive tables created with strict constraints and indexes:
1. `activation_keys`: Stores metadata, capacity (`max_redemptions`), redemption counter, HMAC verifier, and expiration timestamps.
2. `activation_redemptions`: Records individual Telegram account redemptions with `UNIQUE(activation_key_id, telegram_user_id)`.
3. `user_access_grants`: Grants user access with `status = 'active' | 'revoked' | 'expired'`, indexed for `<5ms` lookup.
4. `activation_audit_events`: Immutable audit trail for all key generation, redemption, revocation, and founder administrative actions.

---

## 3. Atomic Redemption Algorithm

To ensure strict zero-oversubscription under high-concurrency requests:
1. Format verification: regex check `^ACRN-BETA-[A-Za-z0-9_-]{32,}$`.
2. Compute HMAC-SHA256 digest with server-side pepper (`ACTIVATION_PEPPER || TELEGRAM_SECRET_TOKEN`).
3. Execute SQL transaction against D1:
   ```sql
   -- Find active key with available capacity
   SELECT id, max_redemptions, redemption_count, redeem_expires_at, access_expires_at, revoked_at
   FROM activation_keys
   WHERE key_hash = ?1;
   ```
4. Verify:
   - Key exists and `revoked_at IS NULL`.
   - `redeem_expires_at IS NULL OR redeem_expires_at > datetime('now')`.
   - `redemption_count < max_redemptions`.
   - User does not already have an active grant.
5. In a single atomic batch:
   - `INSERT INTO activation_redemptions ...`
   - `INSERT OR REPLACE INTO user_access_grants ...`
   - `UPDATE activation_keys SET redemption_count = redemption_count + 1 WHERE id = ?1 AND redemption_count < max_redemptions;`
   - `INSERT INTO activation_audit_events ...`
6. If the conditional `UPDATE` fails to affect 1 row (because another concurrent request grabbed the last slot), roll back and return capacity exhausted error.

---

## 4. Telegram Experience & Access States

### State 1: Unauthorized User (`/start`)
- Welcome message:
  ```
  🌰 Welcome to Acorn!

  Your personal career scout is currently welcoming a small group of early testers.

  Have an activation key? You can use it to unlock Acorn.
  ```
- Buttons: `[🌱 Activate Acorn]`, `[🌰 About Acorn]`.

### State 2: Key Input
- Interactive prompt: `Please send your activation key in this private chat:`
- Valid key: Sets access grant, welcomes user with `"🌱 You're in! Acorn is now active for you."` and immediately displays the complete Acorn features menu.
- Invalid / Exhausted key: Displays `"That activation key couldn't be accepted. Check the key and try again, or request another invitation."`

### State 3: Authorized Tester
- Full access to `/scan`, `/jd`, `/ats`, `/roles`, `/forget`, and natural-language Gemini conversations.
- Tester CANNOT access `/admin`, `/newkey`, `/keys`, `/revoke_*`, or `/testers`.

### State 4: Revoked Tester
- Blocked on all protected commands and callbacks with notification: `"⚠️ Your beta tester access has been deactivated by the administrator. Contact Acorn for assistance."`
- `/forget` remains accessible so users can purge their data at any time.

### State 5: Founder Administrator
- Identified via `ACORN_FOUNDER_TELEGRAM_ID` or fallback to first ID in `ALLOWED_CHAT_IDS`.
- Full access to all bot features PLUS founder-only commands:
  - `/admin`: Control panel.
  - `/newkey`: Interactive step-by-step key generator (Single-use or Capacity-limited).
  - `/keys`: Active key summary with remaining capacity.
  - `/keyinfo <id>`: Detailed audit info and authorized Telegram IDs.
  - `/revoke_key <id>`: Stop new redemptions for a key.
  - `/revoke_user <telegram_id>`: Revoke tester access immediately.
  - `/testers`: Operational overview of active testers and quotas.
  - `/grant_access <telegram_id>`: Direct grant to a tester.

---

## 5. Security & Threat Model

- **HMAC-SHA256 Key Storage**: Raw activation keys are shown to the founder exactly once in Telegram and never stored in plain text.
- **Fail-Closed Authorization**: Database timeouts, malformed IDs, or group chats default to `DENY`.
- **Private Chat Enforcement**: Activation and administration can only occur in 1-on-1 private Telegram chats (`chat.type === 'private'`).
- **No Secret Leaks**: Test suites, CI logs, and git commits never expose secrets or raw tokens.
