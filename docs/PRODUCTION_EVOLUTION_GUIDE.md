# Acorn AI — Production Evolution, Security & Operations Guide

## 1. Architecture Summary
Acorn operates across three coordinated layers:
1. **Batch Harvesting Engine (`src/acorn/`, `job_tracker_bot.py`):** Scheduled 10-minute GitHub Actions runner scraping LinkedIn Guest, Job Bank Canada, and JobSpy (Indeed/Glassdoor/Google), enforcing Canadian geofencing, role token alignment, `<40` applicant velocity ranking, and dual-key SHA-256 deduplication (`seen_jobs.json`).
2. **Edge Cognitive Gateway & REST API (`cloudflare-worker/`):** V8 Isolate handling both real-time Telegram webhooks (`@Acorn_ai_Bot`) and `/api/v1/*` web workspace endpoints backed by Cloudflare Workers KV (`CHAT_HISTORY`) and D1 (`ACORN_DB`).
3. **Web Experience & Workspace (`web/`):** React 18 + TypeScript + Tailwind CSS v4 + Framer Motion application featuring the 15-state `<AcornMascot />`, `<MiniAcornScouts />` ("The scouts return"), client-side PII-redacted Fit Check, and Founder Invitation Console.

## 2. Invitation Lifecycle & Security Controls
- **Generation:** Only authenticated users with `role = 'founder'` can mint invitation keys (`acrn_inv_<36-hex>`).
- **Storage:** Only the `SHA-256` hex digest (`token_hash`) and a truncated preview (`acrn_inv_7f9a…c412`) are stored in D1. The raw key is displayed once upon creation.
- **Redemption & Replay Defense:** Redeeming an invitation atomically transitions `status` from `'active'` to `'redeemed'` and records an `INVITE_REDEEMED` entry in `audit_logs`. Subsequent replay attempts or expired/revoked keys are rejected with `HTTP 403`.

## 3. Verified Telegram Account Linking
1. Authenticated web user initiates linking (`POST /api/v1/telegram/link/start`).
2. Server generates a single-use `acrn_tg_<36-hex>` token with a 10-minute expiration window and stores its SHA-256 hash in `telegram_link_tokens`.
3. User opens `https://t.me/Acorn_ai_Bot?start=<token>`.
4. Bot verifies sender authorization, binds `telegram_chat_id` to the user record, and marks `consumed_at` so the token cannot be replayed.
