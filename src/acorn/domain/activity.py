"""
Acorn Domain: Activity Stream & Audit Trail
===========================================
Defines immutable audit events documenting background intelligence actions
("Kept watch while you didn't") for transparency, user auditability, and GDPR/PIPEDA compliance.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
import uuid
from typing import Any


class ActivityType(str, Enum):
    """Categorization of background career intelligence actions."""
    SCAN_COMPLETED = "scan_completed"
    SIGNAL_SURFACED = "signal_surfaced"
    SIGNAL_INTERACTION = "signal_interaction"
    ATS_EVALUATION = "ats_evaluation"
    ROLES_MODIFIED = "roles_modified"
    DATA_PURGED = "data_purged"


@dataclass
class ActivityEvent:
    """An immutable audit record of an engine activity."""
    id: str = field(default_factory=lambda: f"act_{uuid.uuid4().hex[:10]}")
    user_id: str = ""
    event_type: ActivityType = ActivityType.SCAN_COMPLETED
    headline: str = ""
    description: str = ""
    details: dict[str, Any] = field(default_factory=dict)
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    @classmethod
    def create_scan_event(
        cls,
        user_id: str,
        roles_evaluated: int,
        candidates_found: int,
        signals_surfaced: int,
        suppressed_saturated: int,
    ) -> ActivityEvent:
        """Helper to create a background watch event."""
        return cls(
            user_id=user_id,
            event_type=ActivityType.SCAN_COMPLETED,
            headline="Kept watch across Canadian job boards",
            description=(
                f"Evaluated {roles_evaluated} target roles. Discovered {candidates_found} candidates, "
                f"suppressed {suppressed_saturated} saturated/reposted openings, and surfaced {signals_surfaced} high-conviction Signals."
            ),
            details={
                "roles_evaluated": roles_evaluated,
                "candidates_found": candidates_found,
                "signals_surfaced": signals_surfaced,
                "suppressed_saturated": suppressed_saturated,
            },
        )
