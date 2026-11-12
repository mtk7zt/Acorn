# Acorn Canonical Identity Architecture

**Milestone:** `BETA-02`  
**Purpose:** Establish protocol-independent, transport-agnostic user identities.

---

## 1. Architectural Model

Acorn decouples internal domain identities from third-party delivery channels (Telegram, Web, Mobile):

```text
               ┌────────────────────────┐
               │    Canonical User      │
               │       acorn_users      │
               │    (id: usr_<uuid>)    │
               └───────────┬────────────┘
                           │
       ┌───────────────────┼───────────────────┐
       ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  Telegram    │   │ Future Web   │   │ Future Mobile│
│  Identity    │   │ Identity     │   │ Identity     │
└──────────────┘   └──────────────┘   └──────────────┘
```

### Key Principles
1. **Never Use Transport IDs as Primary Keys:** Numeric Telegram IDs, email addresses, or phone numbers are never used as internal user primary keys.
2. **Canonical Identifiers:** Generated as `usr_<uuid>` (e.g. `usr_4f1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d`).
3. **Idempotent External Bindings:** Stored in `user_external_identities` with `UNIQUE(provider, provider_user_id)`. Returning users always resolve to the exact same canonical `acorn_user_id`.
4. **BETA-01 Coexistence:** BETA-01 authorization grants (`user_access_grants`) remain the authoritative gatekeeper for access permissions, while canonical identity manages ownership of profiles, roles, and scans.
