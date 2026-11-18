"""
Atomic JSON State Storage Implementation (Dual-Key Canonical Deduplication)
===========================================================================
Implements BaseStateStore using POSIX/Windows atomic file replacement
with Dual-Key Canonical SHA-256 deduplication (job_id + fingerprint).
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import json
import logging
import os
from pathlib import Path
import tempfile
from typing import Any

from src.acorn.domain.exceptions import StateStorageError
from src.acorn.interfaces.storage import BaseStateStore

logger = logging.getLogger("acorn.storage")


class AtomicJsonStateStore(BaseStateStore):
    """Thread-safe, atomic JSON persistence store with automated 7-day TTL pruning."""

    def __init__(
        self,
        seen_jobs_path: Path,
        roles_config_path: Path,
        default_roles: list[str] | None = None,
    ):
        self.seen_jobs_path = seen_jobs_path
        self.roles_config_path = roles_config_path
        self.default_roles = default_roles or []

    def _atomic_write_json(self, target_path: Path, data: Any) -> None:
        """
        Writes data to a temporary file in the target directory and executes
        an atomic rename/replace (VULN-06 Remediation).
        """
        target_path.parent.mkdir(parents=True, exist_ok=True)
        serialized = json.dumps(data, indent=2, ensure_ascii=False)

        try:
            with tempfile.NamedTemporaryFile(
                "w",
                dir=str(target_path.parent),
                delete=False,
                encoding="utf-8",
            ) as tf:
                tf.write(serialized)
                temp_name = tf.name

            # os.replace provides atomic guarantees across POSIX and modern Windows
            os.replace(temp_name, target_path)
        except Exception as exc:
            if "temp_name" in locals() and os.path.exists(temp_name):
                os.remove(temp_name)
            raise StateStorageError(f"Atomic write to {target_path} failed: {exc}") from exc

    def load_seen_jobs(self, retention_days: int = 7) -> dict[str, str]:
        """
        Loads and auto-prunes seen keys (both job_id and canonical SHA-256 fingerprints)
        exceeding the 7-day retention horizon.
        """
        if not self.seen_jobs_path.exists():
            return {}

        try:
            raw = self.seen_jobs_path.read_text(encoding="utf-8")
            data = json.loads(raw) if raw.strip() else {}
            if not isinstance(data, dict):
                return {}

            cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
            pruned: dict[str, str] = {}
            for key, ts_str in data.items():
                try:
                    ts = datetime.fromisoformat(ts_str)
                    if ts.tzinfo is None:
                        ts = ts.replace(tzinfo=timezone.utc)
                    if ts >= cutoff:
                        pruned[key] = ts_str
                except ValueError:
                    continue
            return pruned
        except Exception as exc:
            logger.warning("Could not read seen jobs from %s: %s; starting fresh.", self.seen_jobs_path, exc)
            return {}

    def save_seen_jobs(self, seen: dict[str, str]) -> None:
        """Persists seen keys mapping using atomic file replacement."""
        self._atomic_write_json(self.seen_jobs_path, seen)

    def load_roles_config(self) -> dict[str, Any]:
        """Loads target roles and Telegram offset state, initializing defaults if absent."""
        default_cfg: dict[str, Any] = {
            "roles": list(self.default_roles),
            "last_update_id": 0,
            "awaiting_role_input": False,
        }

        if not self.roles_config_path.exists():
            self.save_roles_config(default_cfg)
            return default_cfg

        try:
            raw = self.roles_config_path.read_text(encoding="utf-8")
            data = json.loads(raw) if raw.strip() else {}
            if not isinstance(data, dict):
                return default_cfg

            roles = data.get("roles")
            if not isinstance(roles, list) or not roles:
                roles = list(self.default_roles)

            return {
                "roles": [str(r).strip() for r in roles if str(r).strip()],
                "last_update_id": int(data.get("last_update_id", 0)),
                "awaiting_role_input": bool(data.get("awaiting_role_input", False)),
            }
        except Exception as exc:
            logger.warning("Could not parse %s: %s; using defaults.", self.roles_config_path, exc)
            return default_cfg

    def save_roles_config(self, cfg: dict[str, Any]) -> None:
        """Persists role configuration using atomic file replacement."""
        self._atomic_write_json(self.roles_config_path, cfg)

    def _get_user_seen_path(self, user_id: str) -> Path:
        """Resolves the user-specific seen jobs storage path."""
        safe_uid = "".join(c for c in (user_id or "default") if c.isalnum() or c in ("_", "-"))
        return self.seen_jobs_path.parent.parent / "users" / safe_uid / "seen_jobs.json"

    def load_user_seen_jobs(self, user_id: str, retention_days: int = 14) -> dict[str, str]:
        """Loads and prunes per-user seen job keys."""
        path = self._get_user_seen_path(user_id)
        if not path.exists():
            return {}

        try:
            raw = path.read_text(encoding="utf-8")
            data = json.loads(raw) if raw.strip() else {}
            if not isinstance(data, dict):
                return {}

            cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
            pruned: dict[str, str] = {}
            for key, ts_str in data.items():
                try:
                    ts = datetime.fromisoformat(ts_str)
                    if ts.tzinfo is None:
                        ts = ts.replace(tzinfo=timezone.utc)
                    if ts >= cutoff:
                        pruned[key] = ts_str
                except ValueError:
                    continue
            return pruned
        except Exception as exc:
            logger.warning("Could not read user seen jobs for %s from %s: %s", user_id, path, exc)
            return {}

    def save_user_seen_jobs(self, user_id: str, seen: dict[str, str]) -> None:
        """Persists per-user seen job keys atomically."""
        path = self._get_user_seen_path(user_id)
        self._atomic_write_json(path, seen)

    def is_job_seen_by_user(self, user_id: str, job_key: str) -> bool:
        """Returns True if the specific user has already seen this job key."""
        user_seen = self.load_user_seen_jobs(user_id)
        return job_key in user_seen

    def mark_job_seen_by_user(self, user_id: str, job_id: str, fingerprint: str) -> None:
        """Records both job_id and fingerprint in the user's private seen-job store."""
        user_seen = self.load_user_seen_jobs(user_id)
        now_iso = datetime.now(timezone.utc).isoformat()
        user_seen[job_id] = now_iso
        user_seen[fingerprint] = now_iso
        self.save_user_seen_jobs(user_id, user_seen)
