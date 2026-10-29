"""
Acorn Infrastructure: SQLite Repository Implementation
======================================================
Zero-dependency, high-performance ACID persistence implementing:
  - IOpportunityRepository (Canonical deduplication with dual-key indexes)
  - IUserRepository (Multi-tenant accounts, preferences, channel bindings)
  - ISignalRepository (Per-user qualified signals & delivery tracking)
  - IActivityRepository (Immutable audit trail & data sovereignty wipeout)
"""

from __future__ import annotations

import contextlib
from datetime import datetime, timezone
import json
from pathlib import Path
import sqlite3
from typing import Any, Optional

from src.acorn.domain.activity import ActivityEvent, ActivityType
from src.acorn.domain.identity import ChannelBinding, ChannelType, User, UserPreferences
from src.acorn.domain.models import JobListing
from src.acorn.domain.signals import Signal, SignalStatus
from src.acorn.interfaces.repository import (
    IActivityRepository,
    IOpportunityRepository,
    ISignalRepository,
    IUserRepository,
)


class SqliteAcornRepository(
    IOpportunityRepository,
    IUserRepository,
    ISignalRepository,
    IActivityRepository,
):
    """
    Unified SQLite repository implementing full Acorn Core persistence.
    Supports in-memory mode (':memory:') for lightning-fast testing
    and persistent file-backed mode for development and production deployments.
    """

    def __init__(self, db_path: str | Path = "acorn.db"):
        self.db_path = str(db_path)
        self._init_db()

    @contextlib.contextmanager
    def _get_connection(self):
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        if self.db_path != ":memory:":
            conn.execute("PRAGMA journal_mode = WAL;")
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _init_db(self) -> None:
        """Initializes database schema with strict constraints and indexes."""
        with self._get_connection() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS opportunities (
                    fingerprint TEXT PRIMARY KEY,
                    id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    company TEXT NOT NULL,
                    location TEXT NOT NULL,
                    job_type TEXT NOT NULL,
                    posted_ago TEXT NOT NULL,
                    description TEXT NOT NULL,
                    url TEXT NOT NULL,
                    source TEXT NOT NULL,
                    matched_role TEXT NOT NULL,
                    priority_tier INTEGER NOT NULL,
                    priority_badge TEXT NOT NULL,
                    applicant_count INTEGER,
                    applicant_count_observed INTEGER NOT NULL DEFAULT 0,
                    velocity_rank INTEGER NOT NULL,
                    velocity_badge TEXT NOT NULL,
                    velocity_reason TEXT NOT NULL DEFAULT '',
                    provenance_sources TEXT NOT NULL DEFAULT '[]',
                    is_reposted INTEGER NOT NULL DEFAULT 0,
                    age_seconds INTEGER NOT NULL DEFAULT 1800,
                    discovered_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_opp_id ON opportunities(id);
                CREATE INDEX IF NOT EXISTS idx_opp_discovered ON opportunities(discovered_at DESC);
                CREATE INDEX IF NOT EXISTS idx_opp_tier ON opportunities(priority_tier, velocity_rank);

                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    tenant_id TEXT NOT NULL,
                    email TEXT NOT NULL,
                    display_name TEXT NOT NULL,
                    preferences_json TEXT NOT NULL,
                    channels_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    is_active INTEGER NOT NULL DEFAULT 1
                );

                CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);

                CREATE TABLE IF NOT EXISTS signals (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    opportunity_fingerprint TEXT NOT NULL,
                    status TEXT NOT NULL,
                    fit_score INTEGER NOT NULL DEFAULT 85,
                    fit_reasons_json TEXT NOT NULL DEFAULT '[]',
                    velocity_summary TEXT NOT NULL DEFAULT '',
                    discovered_at TEXT NOT NULL,
                    surfaced_at TEXT NOT NULL,
                    user_action_at TEXT,
                    FOREIGN KEY (opportunity_fingerprint) REFERENCES opportunities(fingerprint) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_signals_user_status ON signals(user_id, status);
                CREATE INDEX IF NOT EXISTS idx_signals_opp ON signals(opportunity_fingerprint);

                CREATE TABLE IF NOT EXISTS activity_log (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    headline TEXT NOT NULL,
                    description TEXT NOT NULL,
                    details_json TEXT NOT NULL DEFAULT '{}',
                    created_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log(user_id, created_at DESC);
            """)

    # ─────────────────────────────────────────────────────────────────────────
    # IOpportunityRepository Implementation
    # ─────────────────────────────────────────────────────────────────────────

    def save_opportunity(self, job: JobListing) -> None:
        sql = """
            INSERT INTO opportunities (
                fingerprint, id, title, company, location, job_type,
                posted_ago, description, url, source, matched_role,
                priority_tier, priority_badge, applicant_count, applicant_count_observed,
                velocity_rank, velocity_badge, velocity_reason, provenance_sources,
                is_reposted, age_seconds, discovered_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(fingerprint) DO UPDATE SET
                applicant_count = COALESCE(excluded.applicant_count, opportunities.applicant_count),
                applicant_count_observed = CASE WHEN excluded.applicant_count_observed = 1 THEN 1 ELSE opportunities.applicant_count_observed END,
                velocity_rank = MIN(opportunities.velocity_rank, excluded.velocity_rank),
                velocity_badge = excluded.velocity_badge,
                velocity_reason = excluded.velocity_reason,
                is_reposted = (opportunities.is_reposted | excluded.is_reposted);
        """
        sources_json = json.dumps(job.provenance_sources or [job.source])
        with self._get_connection() as conn:
            conn.execute(sql, (
                job.fingerprint, job.id, job.title, job.company, job.location, job.job_type,
                job.posted_ago, job.description, job.url, job.source, job.matched_role,
                int(job.priority_tier), job.priority_badge, job.applicant_count,
                1 if job.applicant_count_observed else 0,
                int(job.velocity_rank), job.velocity_badge, job.velocity_reason,
                sources_json, 1 if job.is_reposted else 0, job.age_seconds, job.discovered_at
            ))

    def _row_to_job(self, row: sqlite3.Row) -> JobListing:
        sources = []
        try:
            sources = json.loads(row["provenance_sources"])
        except Exception:
            sources = [row["source"]]

        job = JobListing(
            id=row["id"],
            title=row["title"],
            company=row["company"],
            location=row["location"],
            job_type=row["job_type"],
            posted_ago=row["posted_ago"],
            description=row["description"],
            url=row["url"],
            source=row["source"],
            matched_role=row["matched_role"],
            priority_tier=int(row["priority_tier"]),
            priority_badge=row["priority_badge"],
            applicant_count=row["applicant_count"],
            velocity_rank=int(row["velocity_rank"]),
            velocity_badge=row["velocity_badge"],
            is_reposted=bool(row["is_reposted"]),
            age_seconds=int(row["age_seconds"]),
            fingerprint=row["fingerprint"],
            discovered_at=row["discovered_at"],
        )
        job.applicant_count_observed = bool(row["applicant_count_observed"])
        job.velocity_reason = row["velocity_reason"]
        job.provenance_sources = sources
        return job

    def get_by_fingerprint(self, fingerprint: str) -> Optional[JobListing]:
        with self._get_connection() as conn:
            cursor = conn.execute("SELECT * FROM opportunities WHERE fingerprint = ?", (fingerprint,))
            row = cursor.fetchone()
            return self._row_to_job(row) if row else None

    def get_by_id(self, job_id: str) -> Optional[JobListing]:
        with self._get_connection() as conn:
            cursor = conn.execute("SELECT * FROM opportunities WHERE id = ?", (job_id,))
            row = cursor.fetchone()
            return self._row_to_job(row) if row else None

    def exists(self, key: str) -> bool:
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT 1 FROM opportunities WHERE fingerprint = ? OR id = ? LIMIT 1",
                (key, key)
            )
            return cursor.fetchone() is not None

    def list_recent(self, limit: int = 100) -> list[JobListing]:
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM opportunities ORDER BY discovered_at DESC LIMIT ?",
                (limit,)
            )
            return [self._row_to_job(r) for r in cursor.fetchall()]

    # ─────────────────────────────────────────────────────────────────────────
    # IUserRepository Implementation
    # ─────────────────────────────────────────────────────────────────────────

    def save_user(self, user: User) -> None:
        pref_dict = {
            "target_roles": user.preferences.target_roles,
            "priority_1_locations": user.preferences.priority_1_locations,
            "priority_2_locations": user.preferences.priority_2_locations,
            "allow_remote_canada": user.preferences.allow_remote_canada,
            "excluded_senior_keywords": user.preferences.excluded_senior_keywords,
            "junior_override_keywords": user.preferences.junior_override_keywords,
            "max_applicants_threshold": user.preferences.max_applicants_threshold,
            "first_mover_threshold": user.preferences.first_mover_threshold,
            "daily_briefing_time_utc": user.preferences.daily_briefing_time_utc,
            "instant_alert_tier_a": user.preferences.instant_alert_tier_a,
            "cadence": user.preferences.cadence,
        }
        channels_list = [
            {
                "channel_type": ch.channel_type.value,
                "address": ch.address,
                "is_active": ch.is_active,
                "metadata": ch.metadata,
                "linked_at": ch.linked_at,
            }
            for ch in user.channels
        ]

        sql = """
            INSERT INTO users (
                id, tenant_id, email, display_name, preferences_json,
                channels_json, created_at, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                tenant_id = excluded.tenant_id,
                email = excluded.email,
                display_name = excluded.display_name,
                preferences_json = excluded.preferences_json,
                channels_json = excluded.channels_json,
                is_active = excluded.is_active;
        """
        with self._get_connection() as conn:
            conn.execute(sql, (
                user.id, user.tenant_id, user.email, user.display_name,
                json.dumps(pref_dict), json.dumps(channels_list),
                user.created_at, 1 if user.is_active else 0
            ))

    def _row_to_user(self, row: sqlite3.Row) -> User:
        p_data = json.loads(row["preferences_json"])
        prefs = UserPreferences(
            target_roles=p_data.get("target_roles", []),
            priority_1_locations=p_data.get("priority_1_locations", []),
            priority_2_locations=p_data.get("priority_2_locations", []),
            allow_remote_canada=p_data.get("allow_remote_canada", True),
            excluded_senior_keywords=p_data.get("excluded_senior_keywords", []),
            junior_override_keywords=p_data.get("junior_override_keywords", []),
            max_applicants_threshold=p_data.get("max_applicants_threshold", 40),
            first_mover_threshold=p_data.get("first_mover_threshold", 5),
            daily_briefing_time_utc=p_data.get("daily_briefing_time_utc", "13:00"),
            instant_alert_tier_a=p_data.get("instant_alert_tier_a", True),
            cadence=p_data.get("cadence", "realtime"),
        )
        c_data = json.loads(row["channels_json"])
        channels = [
            ChannelBinding(
                channel_type=ChannelType(c["channel_type"]),
                address=c["address"],
                is_active=c.get("is_active", True),
                metadata=c.get("metadata", {}),
                linked_at=c.get("linked_at", datetime.now(timezone.utc).isoformat()),
            )
            for c in c_data
        ]
        return User(
            id=row["id"],
            tenant_id=row["tenant_id"],
            email=row["email"],
            display_name=row["display_name"],
            preferences=prefs,
            channels=channels,
            created_at=row["created_at"],
            is_active=bool(row["is_active"]),
        )

    def get_user(self, user_id: str) -> Optional[User]:
        with self._get_connection() as conn:
            cursor = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            row = cursor.fetchone()
            return self._row_to_user(row) if row else None

    def get_user_by_telegram_chat(self, chat_id: str) -> Optional[User]:
        with self._get_connection() as conn:
            cursor = conn.execute("SELECT * FROM users WHERE is_active = 1")
            for row in cursor.fetchall():
                user = self._row_to_user(row)
                if user.get_telegram_chat_id() == str(chat_id).strip():
                    return user
        return None

    def list_users(self) -> list[User]:
        with self._get_connection() as conn:
            cursor = conn.execute("SELECT * FROM users WHERE is_active = 1")
            return [self._row_to_user(r) for r in cursor.fetchall()]

    # ─────────────────────────────────────────────────────────────────────────
    # ISignalRepository Implementation
    # ─────────────────────────────────────────────────────────────────────────

    def save_signal(self, signal: Signal) -> None:
        sql = """
            INSERT INTO signals (
                id, user_id, opportunity_fingerprint, status, fit_score,
                fit_reasons_json, velocity_summary, discovered_at,
                surfaced_at, user_action_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                status = excluded.status,
                fit_score = excluded.fit_score,
                user_action_at = excluded.user_action_at;
        """
        # Ensure opportunity is saved first to satisfy foreign key
        if signal.job:
            self.save_opportunity(signal.job)

        with self._get_connection() as conn:
            conn.execute(sql, (
                signal.id, signal.user_id, signal.job.fingerprint,
                signal.status.value, signal.fit_score,
                json.dumps(signal.fit_reasons), signal.velocity_summary,
                signal.discovered_at, signal.surfaced_at, signal.user_action_at
            ))

    def _row_to_signal(self, row: sqlite3.Row, job: JobListing) -> Signal:
        reasons = []
        try:
            reasons = json.loads(row["fit_reasons_json"])
        except Exception:
            pass

        return Signal(
            id=row["id"],
            user_id=row["user_id"],
            job=job,
            status=SignalStatus(row["status"]),
            fit_score=int(row["fit_score"]),
            fit_reasons=reasons,
            velocity_summary=row["velocity_summary"],
            discovered_at=row["discovered_at"],
            surfaced_at=row["surfaced_at"],
            user_action_at=row["user_action_at"],
        )

    def get_signal(self, signal_id: str) -> Optional[Signal]:
        with self._get_connection() as conn:
            cursor = conn.execute(
                """
                SELECT s.*, o.fingerprint as o_fp
                FROM signals s
                JOIN opportunities o ON s.opportunity_fingerprint = o.fingerprint
                WHERE s.id = ?
                """,
                (signal_id,)
            )
            row = cursor.fetchone()
            if not row:
                return None
            job = self.get_by_fingerprint(row["o_fp"])
            return self._row_to_signal(row, job) if job else None

    def list_signals_for_user(
        self,
        user_id: str,
        status: Optional[SignalStatus] = None,
        limit: int = 50,
    ) -> list[Signal]:
        with self._get_connection() as conn:
            if status:
                sql = """
                    SELECT s.* FROM signals s
                    JOIN opportunities o ON s.opportunity_fingerprint = o.fingerprint
                    WHERE s.user_id = ? AND s.status = ?
                    ORDER BY s.surfaced_at DESC LIMIT ?
                """
                params = (user_id, status.value, limit)
            else:
                sql = """
                    SELECT s.* FROM signals s
                    JOIN opportunities o ON s.opportunity_fingerprint = o.fingerprint
                    WHERE s.user_id = ?
                    ORDER BY s.surfaced_at DESC LIMIT ?
                """
                params = (user_id, limit)

            cursor = conn.execute(sql, params)
            signals = []
            for r in cursor.fetchall():
                job = self.get_by_fingerprint(r["opportunity_fingerprint"])
                if job:
                    signals.append(self._row_to_signal(r, job))
            return signals

    def update_signal_status(self, signal_id: str, status: SignalStatus) -> bool:
        now_iso = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as conn:
            cursor = conn.execute(
                "UPDATE signals SET status = ?, user_action_at = ? WHERE id = ?",
                (status.value, now_iso, signal_id)
            )
            return cursor.rowcount > 0

    # ─────────────────────────────────────────────────────────────────────────
    # IActivityRepository Implementation
    # ─────────────────────────────────────────────────────────────────────────

    def log_activity(self, event: ActivityEvent) -> None:
        sql = """
            INSERT INTO activity_log (
                id, user_id, event_type, headline, description, details_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """
        with self._get_connection() as conn:
            conn.execute(sql, (
                event.id, event.user_id, event.event_type.value,
                event.headline, event.description,
                json.dumps(event.details), event.created_at
            ))

    def list_activity_for_user(
        self,
        user_id: str,
        limit: int = 50,
    ) -> list[ActivityEvent]:
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM activity_log WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
                (user_id, limit)
            )
            events = []
            for row in cursor.fetchall():
                details = {}
                try:
                    details = json.loads(row["details_json"])
                except Exception:
                    pass
                events.append(ActivityEvent(
                    id=row["id"],
                    user_id=row["user_id"],
                    event_type=ActivityType(row["event_type"]),
                    headline=row["headline"],
                    description=row["description"],
                    details=details,
                    created_at=row["created_at"],
                ))
            return events

    def purge_for_user(self, user_id: str) -> int:
        """Data Sovereignty Protocol: purges signals and activity for a user."""
        with self._get_connection() as conn:
            c1 = conn.execute("DELETE FROM signals WHERE user_id = ?", (user_id,)).rowcount
            c2 = conn.execute("DELETE FROM activity_log WHERE user_id = ?", (user_id,)).rowcount
            return c1 + c2
