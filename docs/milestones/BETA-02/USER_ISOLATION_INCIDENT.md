# Incident Root Cause Analysis: Cross-User Scan Delivery Defect

**Incident ID:** `INC-BETA-02-01`  
**Severity:** Critical (Privacy & Authorization Isolation Blocker)  
**Status:** Resolved & Permanently Regressed  

---

## 1. Incident Description
During early beta testing following Milestone BETA-01 activation, an invited beta tester redeemed an activation key, gained access to the Acorn bot, and triggered a scan with `/scan`. Acorn did not ask for the tester's target roles, executed a global scrape, and delivered the resulting opportunity alerts to the **founder's Telegram account** instead of the tester who initiated the request.

---

## 2. Root Cause Analysis (RCA)

A complete architectural trace revealed a four-link structural chain causing the defect:

```text
[Telegram Tester] 
       │ 1. Sends /scan
       ▼
[Cloudflare Edge Worker]
       │ 2. Dispatches GitHub Actions without user context ({ ref: 'main' })
       ▼
[GitHub Actions Workflow: job_tracker.yml]
       │ 3. Executes job_tracker_bot.py with TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}
       ▼
[Python Execution Script: job_tracker_bot.py]
       │ 4. Transmits scraped opportunities to hardcoded founder TELEGRAM_CHAT_ID
       ▼
[Founder's Telegram Account Receives Tester's Results]
```

### Direct Failure Points
1. **Edge Dispatch Context Stripping:** In `cloudflare-worker/index.js`, the `/scan` handler invoked `ghDispatchWorkflow(env)` with `body: JSON.stringify({ ref: 'main' })`. No user identity, chat ID, or preference context was passed to the ingestion runner.
2. **Static Repository Secret Fallback:** `.github/workflows/job_tracker.yml` passed `TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}` (configured as the founder's chat ID) as the default recipient.
3. **Absence of User Roles Layer:** `job_tracker_bot.py` relied exclusively on the global `roles_config.json` in repository root, meaning all users implicitly shared the same target roles without personal customization.

---

## 3. Engineering Remediation

1. **Strict Delivery Recipient Binding:**
   - Modified `job_tracker_bot.py` to accept `--target-chat-id <chat_id>`. When provided, notifications are strictly routed to the specified chat ID and never fallback to `TELEGRAM_CHAT_ID`.
   - Updated `.github/workflows/job_tracker.yml` to support `workflow_dispatch` inputs for `target_chat_id`, `target_roles`, and `user_id`.
   - Updated `ghDispatchWorkflow(env, options)` in the Cloudflare Worker to pass `target_chat_id: chatId`, `target_roles: userRoles`, and `user_id: acornUserId`.

2. **Mandatory Role Verification Before Scan:**
   - In `cloudflare-worker/index.js`, when `/scan` or `scan_roles` is executed, the bot checks if the user has configured personal target roles in `user_target_roles`.
   - If no roles are configured, the bot halts dispatch and prompts onboarding:
     > *"🎯 Before scanning, tell Acorn what roles you want to find! Use `/setroles` to set your target positions."*

3. **Audit Tracking:**
   - Every scan request records an immutable record in `user_scan_requests` with `acorn_user_id`, `correlation_id`, and `recipient_address`.

---

## 4. Automated Regression Verification
Added `tests/test_user_isolation.py` containing:
- `test_mandatory_regression_tester_scan_never_delivers_to_founder()`: Verifies that when a tester triggers a scan, exactly 0 messages are delivered to the founder's chat ID and all alerts reach the tester.
- `test_mandatory_two_user_concurrent_scan_isolation()`: Simulates concurrent scans for User A (Backend in Toronto) and User B (Data in Vancouver), verifying zero cross-user message leakage.
