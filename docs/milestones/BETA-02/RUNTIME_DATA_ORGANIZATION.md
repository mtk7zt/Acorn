# Runtime Operational Data Organization & Preservation

**Milestone:** `BETA-02`  
**Purpose:** Relocate non-sensitive runtime state files from repository root into structured directories while preserving deduplication history and working Git-based persistence.

---

## 1. Directory Structure

```text
data/
└── runtime/
    ├── ingestion/
    │   └── seen_jobs.json          <-- Dual-key SHA-256 historical deduplication state
    └── config/
        ├── roles_config.json       <-- Global fallback roles configuration
        └── bot_config.json         <-- Operational settings (TTL, geofence, keywords)
```

---

## 2. Historical Data Integrity
- **100% History Preserved:** All historical job IDs and `fp_` SHA-256 fingerprints in `seen_jobs.json` were preserved during relocation.
- **Zero Truncation:** No records were deleted, reset, or pruned.
- **Privacy Audit:** Verified that operational JSON files contain strictly public IDs, role titles, and timestamps—zero user PII, zero tokens, and zero credentials.

---

## 3. Centralized Path Resolution (`paths.py`)
Acorn introduces `src/acorn/infrastructure/paths.py` supporting:
- `ACORN_DATA_DIR` environment variable override.
- Automatic discovery of canonical `data/runtime/` paths.
- Seamless fallback to legacy root files if encountered.
