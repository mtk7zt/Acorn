## 🌰 Acorn Pull Request

### 1. Summary of Changes
Provide a clear, high-level summary of the architectural changes, optimizations, or bug fixes introduced in this pull request.

- **Component(s) Modified**: [e.g. `src/acorn/`, `cloudflare-worker/`, `web/`, `.github/workflows/`]
- **Related Issue**: Closes # [issue number]

---

### 2. Architectural Design Pattern Adherence
Select the GoF / Clean Architecture design patterns utilized:
- [ ] **Strategy Pattern**: Extensible filtering or geofence rules (`domain/`)
- [ ] **Adapter Pattern**: Scraper implementation wrapping external data source (`infrastructure/scrapers/`)
- [ ] **Repository Pattern**: State persistence (`infrastructure/storage/`)
- [ ] **Facade Pattern**: Pipeline orchestration (`application/pipeline.py`)
- [ ] **Zero-PII Compliance**: No client or candidate personal identifiers persisted in-memory or on disk

---

### 3. Verification & Automated Tests
Please confirm the test suite was executed locally and all tests passed:
```bash
python -m pytest tests/ -v
```
- [ ] All unit tests passed (`tests/test_filtering.py`, `tests/test_geofence.py`, `tests/test_security.py`, `tests/test_storage.py`, `tests/test_velocity.py`)
- [ ] Zero regression in first-mover applicant velocity tiers (< 5 applicants = Tier A)
- [ ] Zero regression in dual-key deduplication hashing (`job_id` + canonical SHA-256 fingerprint)

---

### 4. Security & Privacy Self-Review
- [ ] No hardcoded bot tokens, API keys, or personal email addresses in git history.
- [ ] Fail-closed authorization checks maintained on Cloudflare Worker (`isAuthorizedSender()`).
- [ ] In-memory PII scrubbing (`redact_pii()`) executed before any LLM inference.
