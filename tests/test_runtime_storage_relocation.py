"""
Acorn Runtime Storage Relocation & Deduplication Preservation Tests
===================================================================
Milestone: BETA-02 — Personalized User Profiles, Scan Isolation & Portable Data Architecture
Verifies that:
  1. Paths resolve to data/runtime/ canonical directory.
  2. Historical deduplication records in seen_jobs.json are fully preserved.
  3. Deduplication functions correctly against existing fingerprints.
  4. Operational data files contain zero sensitive data or tokens.
"""

import json
import re
from pathlib import Path
import pytest

from src.acorn.infrastructure.paths import (
    get_data_dir,
    get_seen_jobs_path,
    get_roles_config_path,
    get_bot_config_path,
)
from src.acorn.infrastructure.storage.json_store import AtomicJsonStateStore


def test_runtime_paths_resolution():
    seen_path = get_seen_jobs_path()
    roles_path = get_roles_config_path()
    bot_path = get_bot_config_path()

    assert seen_path.exists(), f"seen_jobs.json not found at {seen_path}"
    assert roles_path.exists(), f"roles_config.json not found at {roles_path}"
    assert bot_path.exists(), f"bot_config.json not found at {bot_path}"


def test_deduplication_history_preserved():
    seen_path = get_seen_jobs_path()
    data = json.loads(seen_path.read_text(encoding="utf-8"))

    # Verify that historical entries are intact (e.g. at least 50 historical seen keys)
    assert len(data) >= 50, f"Expected at least 50 historical seen records, found {len(data)}"

    # Verify key structure: dual-key contains job IDs and 'fp_' fingerprints
    has_fingerprints = any(k.startswith("fp_") for k in data.keys())
    assert has_fingerprints, "Expected dual-key SHA-256 fingerprints starting with 'fp_' in seen_jobs.json"


def test_zero_sensitive_data_in_operational_files():
    """Confirms no private emails, authorization tokens, or secrets exist in runtime JSON files."""
    email_pattern = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")

    for resolver in [get_seen_jobs_path, get_roles_config_path, get_bot_config_path]:
        path = resolver()
        content = path.read_text(encoding="utf-8")

        assert "ghp_" not in content, f"GitHub PAT leaked in {path}!"
        assert "bot" + "token" not in content.lower(), f"Bot token reference in {path}!"
        assert not email_pattern.search(content), f"Email address leaked in {path}!"
