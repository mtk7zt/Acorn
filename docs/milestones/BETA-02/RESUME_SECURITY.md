# Resume Document Security & Quarantine Pipeline

**Milestone:** `BETA-02`  
**Purpose:** Enforce zero-trust validation and quarantine controls on all candidate documents.

---

## 1. Security Verification Pipeline

Before any uploaded document is accepted or processed:
1. **Size Verification:** Maximum document limit is capped at **5MB** (`5 * 1024 * 1024` bytes).
2. **Magic Byte Signature Inspection:**
   - PDF files must start with canonical `%PDF-` bytes (`0x25 0x50 0x44 0x46 0x2D`).
   - Word DOCX files must start with valid OOXML zip header `PK\x03\x04` (`0x50 0x4B 0x03 0x04`).
   - Extensions masquerading as documents (e.g. executable or text files renamed to `.pdf`) are rejected with `ResumeValidationError`.
3. **Cryptographic Checksum:** Every asset receives a SHA-256 integrity hash.
4. **Quarantine State:** Ingested documents default to `security_status = 'quarantined'` in `user_resume_assets`.
5. **Data Sovereignty:** Users can instantly purge stored resume assets with `/deleteresume` or `/forget`.
