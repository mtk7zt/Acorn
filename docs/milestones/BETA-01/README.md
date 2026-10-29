# 🌰 Acorn AI — Milestone BETA-01: Controlled Beta Testing & Activation

**Milestone:** `BETA-01 — Controlled Beta Testing & Activation`  
**Target Repository:** `mtk7zt/Acorn`  
**Branch:** `dev`  
**Status:** Implementation Complete / Ready for Founder-Authorized Rollout  

---

## 1. Purpose & Scope

Milestone **BETA-01** provides the founder of Acorn AI with secure, cryptographically verifiable, and capacity-constrained activation tooling to admit early beta testers to the Acorn Telegram experience.

### Core Objectives
1. **Founder-Only Key Issuance**: Enable the founder to generate single-use (Type A) and capacity-limited (Type B) activation keys directly via Telegram (`/newkey`).
2. **Central Authorization Guard**: Secure all protected commands (`/scan`, `/roles`, `/ats`, `/jd`, inline buttons, Gemini chat) behind a zero-trust authorization check.
3. **Warm Public Onboarding**: Welcome unauthenticated users on `/start` with an onboarding explanation and interactive `[🌱 Activate Acorn]` key redemption flow.
4. **Data Sovereignty**: Provide immediate data wiping (`/forget`) for both authorized testers and public users.
5. **Atomic Capacity Enforcement**: Prevent race conditions or oversubscription when multiple testers redeem capacity-limited keys simultaneously.
6. **Instant Revocation & Lifecycle Management**: Enable the founder to revoke keys (`/revoke_key`) or immediately deactivate tester access (`/revoke_user`).

### Non-Goals (Explicitly Out of Scope)
- No website modifications or website user registration changes.
- No payment processing, subscription management, or billing.
- No live production deployments or schema mutations during automated runs.
- No modification of the core Python job-harvesting pipeline.

---

## 2. Milestone Documentation Index

| Document | Purpose & Contents |
| :--- | :--- |
| **[`ARCHITECTURE_AUDIT.md`](./ARCHITECTURE_AUDIT.md)** | Baseline audit of existing Telegram gateway, D1 migrations, KV memory, and integration points. |
| **[`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md)** | Modular design specifications, boundaries, and atomic redemption algorithms. |
| **[`SECURITY_MODEL.md`](./SECURITY_MODEL.md)** | Threat model, HMAC-SHA256 verifiers, pepper management, and public repo security guarantees. |
| **[`TEST_PLAN.md`](./TEST_PLAN.md)** | Reusable test case templates, execution matrix, and concurrency verification. |
| **[`TESTER_FEEDBACK.md`](./TESTER_FEEDBACK.md)** | Standardized issue intake template and severity grading for beta testers. |
| **[`RELEASE_CHECKLIST.md`](./RELEASE_CHECKLIST.md)** | Founder release checklist, staging smoke tests, and operational verification gates. |
| **[`ROLLBACK.md`](./ROLLBACK.md)** | Emergency procedures, feature disablement without opening bot access, and SQL rollback. |
| **[`IMPLEMENTATION_REPORT.md`](./IMPLEMENTATION_REPORT.md)** | Complete executive and technical sign-off report with test evidence. |

---

## 3. Architecture Overview

```text
Inbound Telegram Update
       │
       ▼
Cloudflare Edge Worker (V8 Isolate)
       │
       ▼
Fail-Closed Secret Token Validation (X-Telegram-Bot-Api-Secret-Token)
       │
       ▼
Central Authorization Guard (resolveAuthRole)
       ├── Role: FOUNDER   ──▶ Dispatch /admin, /newkey, /keys, /testers, /revoke_*
       ├── Role: TESTER    ──▶ Dispatch /scan, /roles, /ats, /jd, Gemini conversations
       ├── Role: PUBLIC    ──▶ Dispatch /start onboarding, /activate redemption, /forget
       └── Role: REVOKED   ──▶ Deny protected features; allow /forget
```

---

## 4. Founder Quick Reference

### Telegram Founder Commands
- `/admin` — Open founder management panel with interactive inline buttons.
- `/newkey [label] [capacity]` — Issue a new activation key (e.g. `/newkey "Cohort Alpha" 5`).
- `/keys` — List recent activation keys with usage ratios and revocation status.
- `/testers` — View active tester counts, revoked counts, and remaining slots.
- `/grant_access <telegram_id>` — Directly authorize a tester without an activation key.
- `/revoke_key <key_id>` — Close an activation key to prevent future redemptions.
- `/revoke_user <telegram_id>` — Immediately terminate a tester's access.
