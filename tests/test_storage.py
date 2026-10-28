"""
Unit Tests: Dual-Key Fingerprint Deduplication & Atomic Storage
"""

import json
from pathlib import Path
import tempfile
import pytest

from src.acorn.domain.models import JobListing
from src.acorn.infrastructure.storage.json_store import AtomicJsonStateStore


def test_dual_key_fingerprint_generation():
    fp1 = JobListing.compute_fingerprint(
        company="RBC Royal Bank",
        title="Junior Software Engineer",
        location="Toronto, ON",
    )
    # Different case and punctuation should produce the exact same canonical fingerprint
    fp2 = JobListing.compute_fingerprint(
        company="rbc-royal bank",
        title="junior software engineer",
        location="toronto, on.",
    )
    assert fp1 == fp2
    assert fp1.startswith("fp_")
    assert len(fp1) == 19  # 'fp_' + 16 chars


def test_atomic_storage_operations():
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        seen_file = tmp_path / "test_seen.json"
        roles_file = tmp_path / "test_roles.json"

        store = AtomicJsonStateStore(
            seen_jobs_path=seen_file,
            roles_config_path=roles_file,
            default_roles=["Junior Developer", "IT Support"],
        )

        # 1. Test roles initialization
        roles_cfg = store.load_roles_config()
        assert len(roles_cfg["roles"]) == 2
        assert "Junior Developer" in roles_cfg["roles"]

        # 2. Test saving seen dual keys
        seen_data = {
            "li_123456": "2026-10-28T12:00:00+00:00",
            "fp_abcdef1234567890": "2026-10-28T12:00:00+00:00",
        }
        store.save_seen_jobs(seen_data)

        # 3. Verify file contents on disk
        loaded_seen = store.load_seen_jobs(retention_days=7)
        assert len(loaded_seen) == 2
        assert "li_123456" in loaded_seen
        assert "fp_abcdef1234567890" in loaded_seen
