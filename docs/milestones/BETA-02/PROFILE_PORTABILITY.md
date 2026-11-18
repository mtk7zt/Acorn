# Acorn Profile Portability Specification (`acorn-profile` v1.0)

**Milestone:** `BETA-02`  
**Purpose:** Establish a standardized, platform-independent JSON schema for career profiles.

---

## 1. Schema Definition

```json
{
  "format": "acorn-profile",
  "schema_version": "1.0",
  "exported_at": "2026-10-29T17:40:00Z",
  "acorn_user_id": "usr_4f1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d",
  "profile": {
    "career_stage": "mid",
    "experience_level": "mid",
    "onboarding_status": "completed"
  },
  "target_roles": [
    {
      "role_title": "Junior Software Engineer",
      "priority": 1
    },
    {
      "role_title": "Cloud Support Analyst",
      "priority": 2
    }
  ],
  "search_preferences": {
    "preferred_locations": ["Toronto", "Remote"],
    "work_arrangement": "remote",
    "seniority": "junior",
    "employment_types": ["full_time"],
    "min_salary": 0,
    "skills": ["python", "fastapi", "docker"],
    "notification_cadence": "instant",
    "timezone": "America/Toronto"
  },
  "resume_manifest": [
    {
      "id": "res_8f3a1b2c...",
      "content_type": "application/pdf",
      "file_size": 128450,
      "checksum": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "security_status": "verified",
      "created_at": "2026-10-29T12:00:00Z"
    }
  ]
}
```

---

## 2. Security & Boundaries
1. **Zero Auth / Credential Leaks:** Secret tokens, activation keys, and internal database passwords are strictly excluded from the export package.
2. **Deterministic Round-Trip:** The export document can be parsed, validated, and imported into any compatible Acorn deployment via `ProfileImportService`.
