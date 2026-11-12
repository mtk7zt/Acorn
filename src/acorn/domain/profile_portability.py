"""
Acorn Profile Portability Architecture (acorn-profile v1.0)
===========================================================
Implements versioned, self-contained, cloud-independent export and import
contracts for user career profiles, target roles, and search preferences.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
import json
from typing import Any, Dict, List, Optional


class ProfilePortabilityError(ValueError):
    """Raised when an exported or imported profile payload violates schema constraints."""
    pass


@dataclass
class ExportedTargetRole:
    role_title: str
    priority: int = 1


@dataclass
class ExportedResumeManifest:
    id: str
    content_type: str
    file_size: int
    checksum: str
    security_status: str
    created_at: str


@dataclass
class AcornProfilePayload:
    """Canonical schema for acorn-profile v1.0 export packages."""
    format: str
    schema_version: str
    exported_at: str
    acorn_user_id: str
    profile: Dict[str, Any]
    target_roles: List[Dict[str, Any]]
    search_preferences: Dict[str, Any]
    resume_manifest: List[Dict[str, Any]]

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2)


class ProfileExportService:
    """Serializes user career profiles into portable, versioned packages."""

    @staticmethod
    def create_export_payload(
        acorn_user_id: str,
        profile_data: Dict[str, Any],
        target_roles: List[str | Dict[str, Any]],
        search_preferences: Dict[str, Any],
        resume_metadata: Optional[Dict[str, Any]] = None,
    ) -> AcornProfilePayload:
        now_iso = datetime.now(timezone.utc).isoformat()

        formatted_roles: List[Dict[str, Any]] = []
        for i, r in enumerate(target_roles):
            if isinstance(r, str):
                formatted_roles.append({"role_title": r.strip(), "priority": i + 1})
            elif isinstance(r, dict):
                formatted_roles.append({
                    "role_title": r.get("role_title", "").strip(),
                    "priority": r.get("priority", i + 1),
                })

        resume_manifest: List[Dict[str, Any]] = []
        if resume_metadata:
            resume_manifest.append({
                "id": resume_metadata.get("id", ""),
                "content_type": resume_metadata.get("content_type", "application/pdf"),
                "file_size": resume_metadata.get("file_size", 0),
                "checksum": resume_metadata.get("checksum", ""),
                "security_status": resume_metadata.get("security_status", "verified"),
                "created_at": resume_metadata.get("created_at", now_iso),
            })

        return AcornProfilePayload(
            format="acorn-profile",
            schema_version="1.0",
            exported_at=now_iso,
            acorn_user_id=acorn_user_id,
            profile={
                "career_stage": profile_data.get("career_stage", "mid"),
                "experience_level": profile_data.get("experience_level", "mid"),
                "onboarding_status": profile_data.get("onboarding_status", "completed"),
            },
            target_roles=formatted_roles,
            search_preferences=search_preferences,
            resume_manifest=resume_manifest,
        )


class ProfileImportService:
    """Validates and hydrates an acorn-profile v1.0 export package."""

    @staticmethod
    def validate_and_parse(payload_json: str | dict) -> AcornProfilePayload:
        if isinstance(payload_json, str):
            try:
                data = json.loads(payload_json)
            except Exception as exc:
                raise ProfilePortabilityError(f"Malformed JSON document: {exc}") from exc
        elif isinstance(payload_json, dict):
            data = payload_json
        else:
            raise ProfilePortabilityError("Payload must be a valid JSON string or dictionary.")

        # 1. Format and version validation
        if data.get("format") != "acorn-profile":
            raise ProfilePortabilityError(
                f"Invalid format '{data.get('format')}'. Expected 'acorn-profile'."
            )

        if data.get("schema_version") != "1.0":
            raise ProfilePortabilityError(
                f"Unsupported schema version '{data.get('schema_version')}'. Supported: '1.0'."
            )

        # 2. Content integrity validation
        target_roles = data.get("target_roles", [])
        if not isinstance(target_roles, list):
            raise ProfilePortabilityError("Field 'target_roles' must be an array.")

        search_prefs = data.get("search_preferences", {})
        if not isinstance(search_prefs, dict):
            raise ProfilePortabilityError("Field 'search_preferences' must be a JSON object.")

        return AcornProfilePayload(
            format=data["format"],
            schema_version=data["schema_version"],
            exported_at=data.get("exported_at", datetime.now(timezone.utc).isoformat()),
            acorn_user_id=data.get("acorn_user_id", ""),
            profile=data.get("profile", {}),
            target_roles=target_roles,
            search_preferences=search_prefs,
            resume_manifest=data.get("resume_manifest", []),
        )
