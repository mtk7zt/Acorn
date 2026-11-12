# Cloud-Independent Storage Architecture

**Milestone:** `BETA-02`  
**Purpose:** Establish provider-neutral storage contracts for user binary assets without binding business logic to specific cloud providers.

---

## 1. Storage Contract (`IResumeStorage`)

Located at `src/acorn/domain/storage.py`, the storage interface defines:
- `put_object(key: str, data: bytes, content_type: str) -> StorageMetadata`
- `get_object(key: str) -> bytes`
- `delete_object(key: str) -> bool`
- `exists(key: str) -> bool`
- `get_metadata(key: str) -> StorageMetadata | None`

---

## 2. Implemented Adapters

### A. `LocalPrivateResumeStorage`
- Stores binary documents in a private, git-ignored directory (`data/private/resumes/`).
- Enforces strict path traversal defenses (`Path(key).name`).
- Used for local development and self-hosted persistent environments.

### B. `CloudflareR2ResumeStorage` (Dormant)
- Satisfies the `IResumeStorage` contract for Cloudflare R2 / AWS S3 S3-compatible APIs.
- Remains dormant and unprovisioned during BETA-02, requiring zero paid infrastructure or account modifications.
