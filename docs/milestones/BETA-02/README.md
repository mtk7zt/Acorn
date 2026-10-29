# 🌰 Acorn AI — Milestone BETA-02

## Personalized User Profiles, Scan Isolation & Portable Data Architecture

**Milestone:** `BETA-02`  
**Status:** Implemented, Verified, Documented  
**Branch:** `dev`  
**Classification:** Core Reliability, Application Security & Data Sovereignty  

---

### Executive Summary

Milestone **BETA-02** resolves the critical user-isolation defect where tester-initiated scans were delivered to the founder's Telegram account, establishes canonical transport-independent identities (`acorn_user_id`), implements isolated career profiles with per-user target roles and search preferences, organizes non-sensitive repository operational files under `data/runtime/`, defines cloud-independent storage contracts for optional resume handling, establishes a versioned profile portability format (`acorn-profile` v1.0), and reconciles project documentation.

---

### Key Milestone Achievements

| Capability | Milestone Delivery | Status |
| :--- | :--- | :--- |
| **Scan Delivery Isolation** | Scan requests retain requesting user context; delivery is strictly bound to requester | ✅ Verified & Tested |
| **Canonical Identity** | `acorn_user_id` (`usr_<uuid>`) decoupled from Telegram IDs | ✅ Verified & Tested |
| **User Profiles & Roles** | Per-user roles, locations, preferences via `/profile`, `/setroles`, `/setlocations` | ✅ Verified & Tested |
| **Operational Files** | Reorganized into `data/runtime/` with 100% deduplication history preserved | ✅ Verified & Tested |
| **Storage Architecture** | Provider-agnostic `IResumeStorage` contract (Local private + dormant R2) | ✅ Verified & Tested |
| **Resume Security** | Strict magic byte verification (`%PDF-`, `PK\x03\x04`), 5MB size limit | ✅ Verified & Tested |
| **Data Portability** | `acorn-profile` v1.0 authenticated JSON export/import | ✅ Verified & Tested |
| **Documentation Alignment** | README test counts (61 tests) and model configurations reconciled | ✅ Verified & Tested |

---

### Milestone Documentation Suite

- [`ARCHITECTURE_AUDIT.md`](./ARCHITECTURE_AUDIT.md) — Pre-implementation audit and baseline facts.
- [`USER_ISOLATION_INCIDENT.md`](./USER_ISOLATION_INCIDENT.md) — Full Root Cause Analysis (RCA) of the cross-user delivery defect.
- [`IDENTITY_MODEL.md`](./IDENTITY_MODEL.md) — Canonical user identity and external provider mapping.
- [`PROFILE_SCHEMA.md`](./PROFILE_SCHEMA.md) — Database schema specifications (D1 Migration 0003).
- [`PERSONALIZED_SCANNING.md`](./PERSONALIZED_SCANNING.md) — Request lifecycle, ownership, and delivery binding.
- [`RUNTIME_DATA_ORGANIZATION.md`](./RUNTIME_DATA_ORGANIZATION.md) — Reorganization of operational data files.
- [`STORAGE_ARCHITECTURE.md`](./STORAGE_ARCHITECTURE.md) — Cloud-independent storage interface & adapters.
- [`RESUME_SECURITY.md`](./RESUME_SECURITY.md) — Multi-stage document validation, quarantine, and privacy rules.
- [`PROFILE_PORTABILITY.md`](./PROFILE_PORTABILITY.md) — `acorn-profile` v1.0 specification and validation logic.
- [`DOCUMENTATION_RECONCILIATION.md`](./DOCUMENTATION_RECONCILIATION.md) — Verified claims vs historical documentation.
- [`TEST_PLAN.md`](./TEST_PLAN.md) — Automated verification matrix across all 61 tests.
- [`RELEASE_CHECKLIST.md`](./RELEASE_CHECKLIST.md) — Founder rollout guide for Cloudflare D1 and Worker deployment.
- [`MIGRATION_GUIDE.md`](./MIGRATION_GUIDE.md) — Execution steps for migration `0003`.
- [`ROLLBACK.md`](./ROLLBACK.md) — Safe rollback plan for `0003_rollback.sql`.
- [`IMPLEMENTATION_REPORT.md`](./IMPLEMENTATION_REPORT.md) — Master engineering implementation summary.
