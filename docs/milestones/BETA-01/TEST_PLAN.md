# Acorn AI — Milestone BETA-01 Test Plan & Execution Matrix
**Document:** `docs/milestones/BETA-01/TEST_PLAN.md`  
**Milestone:** `BETA-01 — Controlled Beta Testing & Activation`  
**Status:** Approved  

---

## 1. Reusable Test Case Specification

```text
Test ID: TC-BETA-01-<NUMBER>
Feature: <Feature Name>
Priority: <Blocker / Critical / Major / Minor>
Environment: <Local SQLite / Node ESM / Cloudflare Isolate>
Preconditions: <Prerequisites>
Steps:
  1. ...
  2. ...
Expected Result: <Expected Behavior>
Actual Result: <Observed Behavior>
Pass/Fail: <PASS / FAIL>
Evidence: <Log or Trace snippet>
```

---

## 2. Test Execution Matrix & Automated Results

| Test ID | Area | Scenario | Automated Coverage File | Result |
| :--- | :--- | :--- | :--- | :---: |
| **TC-BETA-01-01** | Key Gen | Cryptographic entropy (256 bits) & unique token generation | `tests/test_activation_security.py::test_key_generation_entropy_and_format` | ✅ PASS |
| **TC-BETA-01-02** | Type A Key | Single-use redemption admitting exactly 1 user, rejecting 2nd | `tests/test_activation_security.py::test_single_use_activation_key_lifecycle` | ✅ PASS |
| **TC-BETA-01-03** | Key Revoke | Revoking key prevents new redemptions | `tests/test_activation_security.py::test_key_revocation_prevents_new_redemptions` | ✅ PASS |
| **TC-BETA-01-04** | Expiration | Expired key rejection | `tests/test_activation_security.py::test_expired_key_rejection` | ✅ PASS |
| **TC-BETA-01-05** | User Revoke | Deactivating tester immediately transitions grant to `revoked` | `tests/test_activation_security.py::test_user_revocation_lifecycle` | ✅ PASS |
| **TC-BETA-01-06** | Concurrency | 10 concurrent requests for capacity 3 (exactly 3 succeed, 7 rejected) | `tests/test_activation_concurrency.py::test_concurrent_redemptions_atomic_capacity` | ✅ PASS |
| **TC-BETA-01-07** | Idempotency | Replayed Telegram update does not consume duplicate capacity | `tests/test_activation_concurrency.py::test_redemption_idempotency` | ✅ PASS |
| **TC-BETA-01-08** | Edge Crypto | Web Crypto HMAC-SHA256 digest computation in Node ESM | Node test execution in `crypto.js` | ✅ PASS |
| **TC-BETA-01-09** | Regression | Core domain, geofence, velocity, storage, API, and ATS suite | `tests/test_*.py` (44 test cases) | ✅ PASS |

**Total Test Suite Execution:** 44 passed in 1.78s (100% pass rate).
