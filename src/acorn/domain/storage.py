"""
Acorn Cloud-Independent Storage Architecture & Resume Security Validator
========================================================================
Defines provider-neutral storage contracts for user resume assets and
quarantine validation adhering to zero-trust application security principles.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import os
from pathlib import Path
from typing import Optional

# Maximum permissible document size: 5 Megabytes
MAX_DOCUMENT_SIZE_BYTES = 5 * 1024 * 1024

# Canonical magic byte signatures for resume documents
PDF_MAGIC_BYTES = b"%PDF-"
DOCX_MAGIC_BYTES = b"PK\x03\x04"


@dataclass
class StorageMetadata:
    """Metadata describing a stored binary asset."""
    key: str
    content_type: str
    file_size: int
    checksum: str
    created_at: str
    storage_provider: str


class ResumeValidationError(ValueError):
    """Raised when an uploaded document fails strict security or structure validation."""
    pass


class ResumeSecurityValidator:
    """Strict zero-trust validator for resume documents."""

    @staticmethod
    def validate_document(filename: str, content: bytes) -> tuple[str, str]:
        """
        Validates document size, file extension, and true magic byte signature.
        Returns (content_type, checksum).
        """
        if not content:
            raise ResumeValidationError("Uploaded document is completely empty (0 bytes).")

        if len(content) > MAX_DOCUMENT_SIZE_BYTES:
            raise ResumeValidationError(
                f"Document exceeds maximum allowable limit of 5MB (observed: {len(content)} bytes)."
            )

        lower_name = filename.lower().strip()
        checksum = hashlib.sha256(content).hexdigest()

        # Magic byte signature verification
        if lower_name.endswith(".pdf"):
            if not content.startswith(PDF_MAGIC_BYTES):
                raise ResumeValidationError("Security violation: File has .pdf extension but lacks valid %PDF- signature.")
            return "application/pdf", checksum

        elif lower_name.endswith(".docx"):
            if not content.startswith(DOCX_MAGIC_BYTES):
                raise ResumeValidationError("Security violation: File has .docx extension but lacks valid OOXML zip signature.")
            return "application/vnd.openxmlformats-officedocument.wordprocessingml.document", checksum

        else:
            raise ResumeValidationError(
                "Unsupported file format. Acorn strictly accepts only .pdf and .docx documents."
            )


class IResumeStorage(ABC):
    """Abstract provider-neutral storage interface."""

    @abstractmethod
    def put_object(self, key: str, data: bytes, content_type: str) -> StorageMetadata:
        """Stores a binary asset and returns validated storage metadata."""
        pass

    @abstractmethod
    def get_object(self, key: str) -> bytes:
        """Retrieves binary content by key."""
        pass

    @abstractmethod
    def delete_object(self, key: str) -> bool:
        """Permanently removes an object by key."""
        pass

    @abstractmethod
    def exists(self, key: str) -> bool:
        """Checks whether an object exists."""
        pass

    @abstractmethod
    def get_metadata(self, key: str) -> Optional[StorageMetadata]:
        """Retrieves metadata without loading the entire binary content."""
        pass


class LocalPrivateResumeStorage(IResumeStorage):
    """
    Local private filesystem adapter.
    Stores assets in a private, git-ignored directory for development and local persistence.
    """

    def __init__(self, base_dir: Path | str):
        self.base_dir = Path(base_dir).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _resolve_safe_path(self, key: str) -> Path:
        """Guarantees against directory traversal attacks."""
        clean_key = Path(key).name
        return self.base_dir / clean_key

    def put_object(self, key: str, data: bytes, content_type: str) -> StorageMetadata:
        target_path = self._resolve_safe_path(key)
        target_path.write_bytes(data)

        checksum = hashlib.sha256(data).hexdigest()
        now_iso = datetime.now(timezone.utc).isoformat()

        return StorageMetadata(
            key=key,
            content_type=content_type,
            file_size=len(data),
            checksum=checksum,
            created_at=now_iso,
            storage_provider="local_private",
        )

    def get_object(self, key: str) -> bytes:
        target_path = self._resolve_safe_path(key)
        if not target_path.exists():
            raise FileNotFoundError(f"Storage asset not found: {key}")
        return target_path.read_bytes()

    def delete_object(self, key: str) -> bool:
        target_path = self._resolve_safe_path(key)
        if target_path.exists():
            target_path.unlink()
            return True
        return False

    def exists(self, key: str) -> bool:
        return self._resolve_safe_path(key).exists()

    def get_metadata(self, key: str) -> Optional[StorageMetadata]:
        target_path = self._resolve_safe_path(key)
        if not target_path.exists():
            return None
        data = target_path.read_bytes()
        return StorageMetadata(
            key=key,
            content_type="application/octet-stream",
            file_size=len(data),
            checksum=hashlib.sha256(data).hexdigest(),
            created_at=datetime.fromtimestamp(target_path.stat().st_mtime, tz=timezone.utc).isoformat(),
            storage_provider="local_private",
        )


class CloudflareR2ResumeStorage(IResumeStorage):
    """
    Cloudflare R2 Storage Adapter (Dormant / Unprovisioned in BETA-02).
    Satisfies the storage contract and is activated when founder provisions R2 secrets.
    """

    def __init__(self, bucket_name: str = "acorn-resumes", endpoint_url: str = "", account_id: str = ""):
        self.bucket_name = bucket_name
        self.endpoint_url = endpoint_url
        self.account_id = account_id
        self._mock_objects: dict[str, tuple[bytes, StorageMetadata]] = {}

    def put_object(self, key: str, data: bytes, content_type: str) -> StorageMetadata:
        checksum = hashlib.sha256(data).hexdigest()
        now_iso = datetime.now(timezone.utc).isoformat()
        meta = StorageMetadata(
            key=key,
            content_type=content_type,
            file_size=len(data),
            checksum=checksum,
            created_at=now_iso,
            storage_provider="cloudflare_r2",
        )
        self._mock_objects[key] = (data, meta)
        return meta

    def get_object(self, key: str) -> bytes:
        if key not in self._mock_objects:
            raise FileNotFoundError(f"R2 asset not found: {key}")
        return self._mock_objects[key][0]

    def delete_object(self, key: str) -> bool:
        if key in self._mock_objects:
            del self._mock_objects[key]
            return True
        return False

    def exists(self, key: str) -> bool:
        return key in self._mock_objects

    def get_metadata(self, key: str) -> Optional[StorageMetadata]:
        if key in self._mock_objects:
            return self._mock_objects[key][1]
        return None
