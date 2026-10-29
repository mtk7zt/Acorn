"""
Acorn Application: Briefing Synthesis Service
============================================
Synthesizes personalized career briefings (Morning Briefing / On-Demand Scan)
from a user's qualified Signals and activity telemetry.
"""

from __future__ import annotations

import logging
from typing import Optional

from src.acorn.domain.identity import User
from src.acorn.domain.signals import MorningBriefing, Signal, SignalStatus
from src.acorn.interfaces.repository import (
    IActivityRepository,
    IOpportunityRepository,
    ISignalRepository,
)

logger = logging.getLogger("acorn.services.briefing")


class BriefingService:
    """Orchestrates creation and formatting of Morning Briefings."""

    def __init__(
        self,
        signal_repo: ISignalRepository,
        activity_repo: IActivityRepository,
        opportunity_repo: IOpportunityRepository,
    ):
        self.signal_repo = signal_repo
        self.activity_repo = activity_repo
        self.opportunity_repo = opportunity_repo

    def get_latest_briefing(self, user: User, max_signals: int = 5) -> MorningBriefing:
        """
        Retrieves the top unread/saved signals for a user and packages
        them into a curated MorningBriefing.
        """
        unread = self.signal_repo.list_signals_for_user(
            user.id, status=SignalStatus.UNREAD, limit=max_signals * 2
        )
        if not unread:
            # Fallback to recent viewed or saved signals
            unread = self.signal_repo.list_signals_for_user(
                user.id, limit=max_signals
            )

        # Sort by fit_score descending, then priority_tier
        ranked = sorted(
            unread,
            key=lambda s: (s.fit_score, -(s.job.priority_tier if s.job else 3)),
            reverse=True,
        )[:max_signals]

        # Get recent activity telemetry
        activities = self.activity_repo.list_activity_for_user(user.id, limit=1)
        scanned_count = 0
        suppressed_count = 0
        if activities:
            details = activities[0].details
            scanned_count = details.get("candidates_found", 0)
            suppressed_count = details.get("suppressed_saturated", 0)

        return MorningBriefing(
            user_id=user.id,
            headline="🌰 Acorn Career Briefing",
            subheadline="Qualified tech opportunities worth your attention",
            signals=ranked,
            scanned_roles_count=scanned_count,
            suppressed_count=suppressed_count,
        )
