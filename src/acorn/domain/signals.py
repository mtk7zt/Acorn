"""
Acorn Domain: Signals & Briefings
=================================
Defines qualified individual career Signals and curated Morning Briefings,
encapsulating grounded provenance and actionable fit reasons.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
import uuid
from typing import Any

from src.acorn.domain.models import JobListing


class SignalStatus(str, Enum):
    """Lifecycle status of a personalized career signal."""
    UNREAD = "unread"
    VIEWED = "viewed"
    SAVED = "saved"
    APPLIED = "applied"
    DISMISSED = "dismissed"


@dataclass
class Signal:
    """
    A personalized, qualified opportunity surfaced to a specific user.
    Couples a canonical job opening with grounded fit rationale and urgency.
    """
    id: str = field(default_factory=lambda: f"sig_{uuid.uuid4().hex[:12]}")
    user_id: str = ""
    job: JobListing = field(default_factory=lambda: None)  # type: ignore
    status: SignalStatus = SignalStatus.UNREAD
    fit_score: int = 85
    fit_reasons: list[str] = field(default_factory=list)
    velocity_summary: str = ""
    discovered_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    surfaced_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    user_action_at: str | None = None

    def mark_applied(self) -> None:
        self.status = SignalStatus.APPLIED
        self.user_action_at = datetime.now(timezone.utc).isoformat()

    def mark_saved(self) -> None:
        self.status = SignalStatus.SAVED
        self.user_action_at = datetime.now(timezone.utc).isoformat()

    def mark_dismissed(self) -> None:
        self.status = SignalStatus.DISMISSED
        self.user_action_at = datetime.now(timezone.utc).isoformat()

    def mark_viewed(self) -> None:
        if self.status == SignalStatus.UNREAD:
            self.status = SignalStatus.VIEWED


@dataclass
class MorningBriefing:
    """
    A curated, bite-sized briefing containing high-conviction Signals
    surfaced for a user's morning review or on-demand scan.
    """
    id: str = field(default_factory=lambda: f"brf_{uuid.uuid4().hex[:10]}")
    user_id: str = ""
    headline: str = "🌰 Acorn Career Briefing"
    subheadline: str = "Signals discovered while keeping watch"
    signals: list[Signal] = field(default_factory=list)
    scanned_roles_count: int = 0
    suppressed_count: int = 0
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    @property
    def signal_count(self) -> int:
        return len(self.signals)

    def to_summary_text(self) -> str:
        """Renders a friendly executive briefing summary."""
        if not self.signals:
            return (
                f"🌰 <b>Acorn Briefing</b>\n\n"
                f"I kept watch across your target roles and scanned <b>{self.scanned_roles_count}</b> listings.\n"
                f"No roles met our first-mover quality and applicant velocity standards today. "
                f"Rest easy—I'll keep watch in the background."
            )

        lines = [
            f"🌰 <b>Acorn Briefing — {len(self.signals)} High-Conviction Signals</b>\n",
            f"<i>Kept watch across your roles. Screened {self.scanned_roles_count} openings; filtered {self.suppressed_count} saturated or reposted listings.</i>\n",
        ]
        for idx, sig in enumerate(self.signals, 1):
            j = sig.job
            app_str = f"{j.applicant_count} applicants" if j.applicant_count is not None else "Fresh opening"
            lines.append(
                f"<b>{idx}. {j.title}</b> at <b>{j.company}</b>\n"
                f"   📍 {j.location} • 🕒 {j.posted_ago} • 👥 {app_str}\n"
                f"   ⚡ {sig.velocity_summary or j.velocity_badge}\n"
                f"   🔗 <a href=\"{j.url}\">View Opening</a>\n"
            )

        return "\n".join(lines)
