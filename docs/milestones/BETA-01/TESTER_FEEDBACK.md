# Acorn AI — Milestone BETA-01 Tester Feedback Guide & Bug Intake
**Document:** `docs/milestones/BETA-01/TESTER_FEEDBACK.md`  
**Milestone:** `BETA-01 — Controlled Beta Testing & Activation`  
**Status:** Approved  

---

## 1. Standard Tester Feedback Intake Form

Beta testers should submit reports using this template:

```markdown
### 🌰 Acorn Beta Tester Feedback Report

**Feature Tested:** [e.g., Activation Key Redemption / Job Scan / ATS Resume Check / JD Breakdown]
**What Were You Trying To Do?**
[Describe your goal]

**What Happened?**
[Describe what the bot did]

**What Did You Expect?**
[Describe expected behavior]

**Steps To Reproduce:**
1. Send command `/...`
2. Tap button `[...]`
3. Enter `...`

**Severity:** [Blocker / Critical / Major / Minor]
**Device / Client:** [e.g., Telegram iOS / Android / Desktop / Web]
**Additional Feedback / Ideas:**
[Any other notes]
```

> **IMPORTANT:** Never include your private activation key, full legal name, phone number, or email in feedback reports. Acorn operates strictly under Zero-PII principles.

---

## 2. Bug Severity Definitions

- **Blocker**: Unauthorized access, founder lockout, plain text token exposure, cross-user data leakage, or total bot outage.
- **Critical**: Activation consistently fails, valid testers cannot access features, or revocation fails to block users.
- **Major**: Core feature impaired (e.g. `/scan` returns errors, ATS scoring produces blank output).
- **Minor**: Non-blocking UX or copy inconsistencies, cosmetic alignment issues.
