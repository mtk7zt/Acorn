# Acorn AI — Milestone BETA-01 Architecture Audit
**Document:** `docs/milestones/BETA-01/ARCHITECTURE_AUDIT.md`  
**Milestone:** `BETA-01 — Controlled Beta Testing & Activation`  
**Date:** 2026-10-29  
**Status:** Complete  

---

## 1. Verified System Components

| Component | Physical Location | Runtime / Language | Verified Role in System |
| :--- | :--- | :--- | :--- |
| **Telegram Edge Gateway** | `cloudflare-worker/index.js` | Cloudflare Worker (V8 JS) | Receives all Telegram webhook updates, validates secret token, gates access via `isAuthorizedSender()`, handles commands & Gemini chat. |
| **Edge Web API Router** | `cloudflare-worker/api_v1_routes.js` | Cloudflare Worker (V8 JS) | Handles `/api/v1/invitations`, `/api/v1/me`, `/api/v1/signals` against D1. |
| **Edge KV Store** | Cloudflare Workers KV (`CHAT_HISTORY`) | KV Store | Stores user conversation history, session flags (`awaiting_ats:`, `awaiting_jd:`), and personality settings. |
| **Edge SQL Database** | Cloudflare D1 (`migrations/0001_...`) | SQLite 3 / D1 | Contains tables: `users`, `sessions`, `invitations`, `access_requests`, `telegram_link_tokens`, `user_signals`, `audit_logs`. |
| **Core Domain Engine** | `src/acorn/domain/` | Python 3.11+ | Multi-tenant entities (`identity.py`, `signals.py`), ATS redactor & Google XYZ generator (`security.py`), geofence, and velocity. |
| **Persistence Repositories** | `src/acorn/infrastructure/persistence/` | Python 3.11+ (SQLite WAL) | Transactional local repository with foreign keys and deduplication. |
| **Scheduled Job Harvester** | `job_tracker_bot.py` + `.github/workflows/job_tracker.yml` | Python 3.11 + GitHub Actions | Automated 10-minute harvesting pipeline pushing alerts to Telegram via `TelegramNotifier`. |

---

## 2. Existing Authorization Path Audit

1. **Telegram Webhook Authenticity**:
   - `cloudflare-worker/index.js`:
     ```javascript
     const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
     if (!env.TELEGRAM_SECRET_TOKEN || secret !== env.TELEGRAM_SECRET_TOKEN) {
       return new Response('Unauthorized', { status: 401 });
     }
     ```
   - *Finding*: Fail-closed secret token verification is correctly active on HTTP level.

2. **Chat Authorization Gate**:
   - Implemented via `isAuthorizedSender(chatId, env)`:
     ```javascript
     function isAuthorizedSender(chatId, env) {
       const allowlistRaw = env.ALLOWED_CHAT_IDS || env.ALLOWED_CHAT_ID || env.TELEGRAM_CHAT_ID || '';
       const allowedSet = new Set(allowlistRaw.split(',').map((s) => s.trim()).filter(Boolean));
       return allowedSet.has(String(chatId).trim());
     }
     ```
   - *Finding*: In `handleMessage()` and `handleCallbackQuery()`, unauthenticated users are currently **silently ignored** (`if (!isAuthorizedSender(chatId, env)) return;`). There is no public `/start` greeting, no activation prompt, and no dynamic key redemption.

3. **Existing Invitation System (`api_v1_routes.js`)**:
   - Table `invitations` in `migrations/0001_acorn_production_auth_and_invites.sql` stores:
     `id`, `recipient_email`, `role`, `key_preview`, `token_hash`, `status`, `expires_at`, `redeemed_by_user_id`.
   - *Finding*: The existing `invitations` table is explicitly scoped to **website user registration** via email (`recipient_email`, `sessions` cookies).
   - *Directive Compliance*: As mandated by Executive Directive 1.2, **Telegram beta activation must be kept distinct from website invitations**. A Telegram activation key must never automatically create a website session or grant website admin privileges.

---

## 3. Database Ownership & Authoritative Store Decision

1. **Authoritative Store for Telegram Activation**:
   - Because the Telegram webhook runs in the Cloudflare Worker (`cloudflare-worker/index.js`), the **Cloudflare D1 SQL database (`ACORN_DB`)** backed by Workers KV caching is the authoritative datastore for real-time edge authorization and key redemption.
   - For environments or local tests running without a live D1 binding, the system gracefully falls back to:
     - Verified static allowlist (`ALLOWED_CHAT_IDS` / `TELEGRAM_CHAT_ID`) for founder access.
     - Workers KV cache (`CHAT_HISTORY`) for grant caching.
     - Python-level equivalent repository in `src/acorn/infrastructure/persistence/` for Python test automation.

---

## 4. Integration Points for BETA-01

1. **Central Authorization Guard (`cloudflare-worker/activation/auth.js`)**:
   - Replace the static single-check `isAuthorizedSender()` with a layered Central Authorization Guard:
     1. Is the user the verified Founder (`ACORN_FOUNDER_TELEGRAM_ID` / `TELEGRAM_CHAT_ID`)? -> `ALLOW (ROLE: FOUNDER)`.
     2. Does the user possess an active, non-expired, non-revoked `user_access_grants` record? -> `ALLOW (ROLE: TESTER)`.
     3. Is the command a public command (`/start`, `/activate`, `/help`, `/about`)? -> `ALLOW_PUBLIC`.
     4. Otherwise -> `DENY`.
2. **Public Onboarding Flow in `handleMessage()`**:
   - When an unauthenticated user sends `/start`, display the warm onboarding greeting:
     `"🌰 Welcome to Acorn! ... Have an activation key? You can use it to unlock Acorn."` with buttons `[🌱 Activate Acorn]`, `[🌰 About Acorn]`.
   - When the user selects `[🌱 Activate Acorn]` or sends `/activate <key>`, enter interactive private redemption.
3. **Atomic Redemption Service (`cloudflare-worker/activation/service.js`)**:
   - Check key format (`ACRN-BETA-...`).
   - Compute HMAC-SHA256 / SHA-256 verifier.
   - Execute single D1 atomic conditional update / transaction:
     - Check `revoked_at IS NULL` and `(redeem_expires_at IS NULL OR redeem_expires_at > datetime('now'))`.
     - Check `redemption_count < max_redemptions`.
     - Check unique `(activation_key_id, telegram_user_id)` constraint in `activation_redemptions`.
     - Insert into `activation_redemptions` and `user_access_grants`.
     - Increment `redemption_count = redemption_count + 1`.
4. **Founder Administration Commands**:
   - When sender is verified founder:
     - `/admin` — Show founder control panel.
     - `/newkey` — Interactive key generation (Type A single-use or Type B capacity-limited).
     - `/keys` — List active keys without revealing raw tokens.
     - `/keyinfo <id>` — Inspect key metrics and authorized testers.
     - `/revoke_key <id>` — Revoke future redemption.
     - `/revoke_user <telegram_id>` — Revoke tester access grant immediately.
     - `/testers` — Show active, revoked, and remaining tester quotas.
     - `/grant_access <telegram_id>` — Manually whitelist a tester without a key.

---

## 5. Compatibility & Preservation Contract

The following existing features **must remain completely operational**:
- `/scan` manual trigger of GitHub Actions job tracker.
- `/jd` Job Description parsing and Google XYZ statement generation.
- `/ats` resume scoring with Zero-PII sanitization.
- `/roles` and role management actions (`ADD_ROLE`, `REMOVE_ROLE`).
- `/forget` KV conversational and resume wipe.
- Gemini 1.5 Flash conversational chat.
- All inline keyboards (`scan_roles`, `jd_prompt`, `ats_prompt`, `list_roles`, `add_role_prompt`, `wipe_prompt`, `fit_*`).
- React web application in `apps/web/` (untouched).
- Python discovery pipeline in `job_tracker_bot.py` (untouched).

---

## 6. Files Expected to Change / Be Added

### New Files
- `migrations/0002_acorn_beta_activation_keys.sql` — Additive D1 schema for activation keys, redemptions, and user access grants.
- `migrations/0002_rollback.sql` — Safe rollback script for migration 0002.
- `cloudflare-worker/activation/` — Modular activation package:
  - `crypto.js`: Cryptographically secure key generation and HMAC-SHA256 verifiers.
  - `repository.js`: D1 + KV access grant queries and atomic redemption logic.
  - `service.js`: Domain service coordinating key issuance, redemption, and revocation.
  - `auth.js`: Central Authorization Guard.
  - `admin.js`: Founder administration command handlers.
- `tests/test_activation_security.py` — Python verification of key generation, entropy, single-use, limited capacity, expiration, and revocation.
- `tests/test_activation_concurrency.py` — Atomic oversubscription and idempotency tests.
- `docs/milestones/BETA-01/` — All required BETA-01 documentation files.

### Modified Files
- `cloudflare-worker/index.js` — Plug in Central Authorization Guard, public `/start` & `/activate` flows, and founder `/admin` commands while preserving all existing handlers.
- `cloudflare-worker/wrangler.toml` — Declare D1 database binding `ACORN_DB` for local development/production compatibility.
