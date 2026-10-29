# Acorn AI — Milestone BETA-01 Security Model & Public Repository Threat Analysis
**Document:** `docs/milestones/BETA-01/SECURITY_MODEL.md`  
**Milestone:** `BETA-01 — Controlled Beta Testing & Activation`  
**Status:** Approved  

---

## 1. Public Repository Threat Model

Because Acorn's source repository is publicly accessible, the system's security architecture operates under the assumption that an adversary possesses:
1. Complete read access to all source code, SQL schemas, and regexes.
2. Complete knowledge of key-generation formats and HMAC hashing logic.
3. Complete knowledge of administrative command names (`/admin`, `/newkey`, `/revoke_user`).
4. A legitimate, working beta tester activation key.

### Security Guarantees Under This Threat Model

| Potential Attack Vector | System Defense & Mitigation | Verified Outcome |
| :--- | :--- | :--- |
| **Forging Activation Keys** | Keys use 256 bits of CSPRNG entropy (`crypto.getRandomValues`) and are verified with server-side HMAC-SHA256 using an uncommitted `ACTIVATION_PEPPER`. | **Blocked**: Attacker cannot compute valid hashes without the production pepper. |
| **Privilege Escalation** | `isFounder()` validates the caller's immutable Telegram numeric user ID against `ACORN_FOUNDER_TELEGRAM_ID`. Tester status can never grant administrative rights. | **Blocked**: Invoking `/admin` or `/newkey` from a non-founder account returns silent failure or access rejection. |
| **Simultaneous Key Oversubscription** | Key redemption utilizes conditional atomic database writes (`WHERE redemption_count < max_redemptions`) and unique constraints `UNIQUE(activation_key_id, telegram_user_id)`. | **Blocked**: Race conditions cannot exceed configured capacity; surplus concurrent requests fail immediately. |
| **Replaying Consumed Keys** | Redemptions are recorded in `activation_redemptions` table with unique user constraints. | **Blocked**: Subsequent redemptions by the same or different users fail. |
| **Forging Webhook Calls** | The Cloudflare Worker validates `X-Telegram-Bot-Api-Secret-Token` on every request. | **Blocked**: Requests lacking the exact secret token return HTTP 401 Unauthorized. |
| **Cross-User Data Exposure** | Conversations and preferences are strictly partitioned in KV by numeric `chat.id` (`history:${chatId}`). | **Blocked**: Tester A cannot read or modify Tester B's conversational memory or tracked roles. |
| **Secret Leaks via Git or Logs** | Raw activation keys are displayed once in private founder Telegram chat and never written to database tables or logs. CI pipelines scan for secret tokens. | **Blocked**: Zero plaintext tokens exist in persistence or version control. |

---

## 2. Cryptographic Token Specifications

- **Entropy**: 256 bits generated via Web Crypto API `crypto.getRandomValues(new Uint8Array(32))`.
- **Format**: `ACRN-BETA-<64-char-hex>`.
- **Storage Verifier**: HMAC-SHA256 hex digest:
  $$\text{Verifier} = \text{HMAC-SHA256}(\text{Key} = \text{ACTIVATION\_PEPPER}, \text{Message} = \text{RawKey})$$
- **Revocation**: Hard revocation flag `revoked_at` stops all future redemptions instantaneously.
