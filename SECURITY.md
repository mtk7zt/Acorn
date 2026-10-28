# Security Policy

## 🛡️ Security Overview

Acorn AI operates on defense-in-depth security principles. Because the system bridges automated web harvesting, cloud edge functions, and large language model (LLM) processing, strict safeguards are enforced across all integration surfaces in compliance with **NIST SP 800-53 Rev. 5**, **OWASP Top 10:2021**, and the **OWASP LLM Top 10 (2025)**.

---

## 🔒 Supported Versions

| Version | Supported | Maintenance Status |
|:---|:---:|:---|
| **2.0.x** | ✅ | Current Production Release (Clean Architecture & Edge AI) |
| **1.0.x** | ❌ | Deprecated Legacy Prototype |

---

## 📋 Security Controls & Protections

### 1. Multi-User Zero-Trust Authorization (NIST AC-3 / OWASP A01:2021)
The Cloudflare Worker edge gateway strictly rejects any webhook event where `chat.id` is not present within the configured `ALLOWED_CHAT_IDS` environment variable. Unauthorized requests receive an immediate `HTTP 403` or are dropped silently without invoking LLM tokens.

### 2. Fail-Closed Webhook Validation (NIST SC-8)
Inbound Telegram webhooks are validated against the `X-Telegram-Bot-Api-Secret-Token` header. If the secret token is missing or mismatched, the request is rejected with `HTTP 401 Unauthorized`.

### 3. Prompt Injection Defense (OWASP LLM01:2025)
All LLM output actions (`ADD_ROLE`, `REMOVE_ROLE`, `UPDATE_MAX_AGE`) undergo strict schema parsing and regex whitelist validation (`ROLE_NAME_REGEX`). LLM directives cannot execute arbitrary shell commands or unsanitized file mutations.

### 4. Zero-PII Memory Scrubber & ATS Co-Pilot (OWASP LLM02:2025 / NIST MP-6)
When users invoke `/ats` to evaluate resumes:
- Email addresses, phone numbers, Canadian postal codes, Social Insurance Numbers (SINs), and LinkedIn profile links are **redacted in memory** before any processing.
- Resume texts are never written to disk, Workers KV, or third-party logging engines.
- Users can issue `/forget` or tap `[🗑️ Wipe My Data]` at any time to purge conversational turns from Cloudflare Workers KV.

### 5. Atomic Storage & Concurrency Protections
- Local JSON state writes (`seen_jobs.json`, `roles_config.json`) use POSIX atomic file replacement (`tempfile.NamedTemporaryFile` + `os.replace`), preventing corruption from container shutdowns.
- GitHub REST API mutations enforce Optimistic Concurrency Control (OCC) with automatic retry backoff upon HTTP 409 SHA conflicts.

---

## 🚨 Reporting a Vulnerability

If you discover a potential security vulnerability within the Acorn platform, please **do not** disclose it publicly via GitHub Issues.

1. Email a vulnerability report directly to: **security@mtk7zt.dev** (or open a private [GitHub Security Advisory](https://github.com/mtk7zt/Acorn/security/advisories)).
2. Include:
   - Detailed description of the vulnerability.
   - Steps to reproduce or proof-of-concept payload.
   - Potential impact assessment.
3. You will receive an initial response within **24 hours**, with triage and remediation status communicated regularly until a patch is released.
