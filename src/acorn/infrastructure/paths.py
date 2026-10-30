"""
Acorn Centralized Runtime Path Resolution
==========================================
Provides standard, portable, cross-platform path resolution for Acorn
runtime operational files with backward compatibility for legacy roots.
"""

from __future__ import annotations

import os
from pathlib import Path

# Resolve base project directory
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent


def get_data_dir() -> Path:
    """Returns the base data directory (default: data/runtime under project root)."""
    env_dir = os.getenv("ACORN_DATA_DIR")
    if env_dir:
        return Path(env_dir).resolve()
    return (PROJECT_ROOT / "data" / "runtime").resolve()


def get_seen_jobs_path() -> Path:
    """
    Resolves the canonical path to seen_jobs.json:
    1. Explicit SEEN_JOBS_FILE environment variable.
    2. data/runtime/ingestion/seen_jobs.json.
    3. Legacy fallback to seen_jobs.json in project root.
    """
    env_file = os.getenv("SEEN_JOBS_FILE")
    if env_file:
        return Path(env_file).resolve()

    canonical = get_data_dir() / "ingestion" / "seen_jobs.json"
    if canonical.exists():
        return canonical

    legacy = PROJECT_ROOT / "seen_jobs.json"
    if legacy.exists():
        return legacy

    # Default to canonical even if not yet created
    return canonical


def get_user_seen_jobs_path(user_id: str = "") -> Path:
    """
    Resolves the canonical path to per-user seen jobs tracking.
    Stored under data/runtime/users/{safe_user_id}/seen_jobs.json.
    """
    safe_uid = "".join(c for c in (user_id or "default") if c.isalnum() or c in ("_", "-"))
    return get_data_dir() / "users" / safe_uid / "seen_jobs.json"


def get_roles_config_path() -> Path:
    """
    Resolves the canonical path to roles_config.json:
    1. Explicit ROLES_CONFIG_FILE environment variable.
    2. data/runtime/config/roles_config.json.
    3. Legacy fallback to roles_config.json in project root.
    """
    env_file = os.getenv("ROLES_CONFIG_FILE")
    if env_file:
        return Path(env_file).resolve()

    canonical = get_data_dir() / "config" / "roles_config.json"
    if canonical.exists():
        return canonical

    legacy = PROJECT_ROOT / "roles_config.json"
    if legacy.exists():
        return legacy

    return canonical


def get_bot_config_path() -> Path:
    """
    Resolves the canonical path to bot_config.json:
    1. Explicit BOT_CONFIG_FILE environment variable.
    2. data/runtime/config/bot_config.json.
    3. Legacy fallback to bot_config.json in project root.
    """
    env_file = os.getenv("BOT_CONFIG_FILE")
    if env_file:
        return Path(env_file).resolve()

    canonical = get_data_dir() / "config" / "bot_config.json"
    if canonical.exists():
        return canonical

    legacy = PROJECT_ROOT / "bot_config.json"
    if legacy.exists():
        return legacy

    return canonical
