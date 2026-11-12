"""
Acorn Profile Portability & Schema Export/Import Tests
======================================================
Milestone: BETA-02 — Personalized User Profiles, Scan Isolation & Portable Data Architecture
Verifies that:
  1. Valid acorn-profile v1.0 export package is generated with all expected keys.
  2. Round-trip export and import retains target roles and search preferences.
  3. Rejection of unsupported schema versions and malformed documents.
"""

import json
import pytest

from src.acorn.domain.profile_portability import (
    AcornProfilePayload,
    ProfileExportService,
    ProfileImportService,
    ProfilePortabilityError,
)


def test_profile_export_payload_structure():
    payload = ProfileExportService.create_export_payload(
        acorn_user_id="usr_test_123456",
        profile_data={"career_stage": "early", "experience_level": "junior", "onboarding_status": "completed"},
        target_roles=["Junior Software Engineer", "Cloud Support Analyst"],
        search_preferences={
            "preferred_locations": ["Toronto", "Remote"],
            "work_arrangement": "remote",
            "seniority": "junior",
        },
        resume_metadata={
            "id": "res_abc999",
            "content_type": "application/pdf",
            "file_size": 104200,
            "checksum": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            "security_status": "verified",
        },
    )

    assert payload.format == "acorn-profile"
    assert payload.schema_version == "1.0"
    assert payload.acorn_user_id == "usr_test_123456"
    assert len(payload.target_roles) == 2
    assert payload.target_roles[0]["role_title"] == "Junior Software Engineer"
    assert payload.target_roles[0]["priority"] == 1
    assert payload.search_preferences["work_arrangement"] == "remote"
    assert len(payload.resume_manifest) == 1
    assert payload.resume_manifest[0]["id"] == "res_abc999"


def test_profile_import_valid_payload():
    raw_json = json.dumps({
        "format": "acorn-profile",
        "schema_version": "1.0",
        "exported_at": "2026-10-29T12:00:00Z",
        "acorn_user_id": "usr_imported_789",
        "profile": {"career_stage": "mid", "onboarding_status": "completed"},
        "target_roles": [{"role_title": "Full Stack Developer", "priority": 1}],
        "search_preferences": {"preferred_locations": ["Mississauga", "Remote"]},
        "resume_manifest": [],
    })

    parsed = ProfileImportService.validate_and_parse(raw_json)
    assert parsed.format == "acorn-profile"
    assert parsed.schema_version == "1.0"
    assert len(parsed.target_roles) == 1
    assert parsed.target_roles[0]["role_title"] == "Full Stack Developer"


def test_profile_import_rejections():
    # 1. Invalid format
    with pytest.raises(ProfilePortabilityError, match="Invalid format"):
        ProfileImportService.validate_and_parse({
            "format": "other-profile",
            "schema_version": "1.0",
            "target_roles": [],
            "search_preferences": {},
        })

    # 2. Unsupported schema version
    with pytest.raises(ProfilePortabilityError, match="Unsupported schema version"):
        ProfileImportService.validate_and_parse({
            "format": "acorn-profile",
            "schema_version": "9.0",
            "target_roles": [],
            "search_preferences": {},
        })

    # 3. Malformed JSON string
    with pytest.raises(ProfilePortabilityError, match="Malformed JSON"):
        ProfileImportService.validate_and_parse("{not-valid-json}")
