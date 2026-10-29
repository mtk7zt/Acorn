"""
Acorn Application: Personalized Opportunity Matching Service
============================================================
Evaluates canonical opportunities against individual user preferences,
enforcing strict title token relevance, Canadian geofencing,
and first-mover applicant velocity to synthesize high-conviction Signals.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
import logging
from typing import Optional

from src.acorn.domain.activity import ActivityEvent, ActivityType
from src.acorn.domain.filtering import is_relevant_title
from src.acorn.domain.geofence import validate_canadian_and_remote_eligibility
from src.acorn.domain.identity import User
from src.acorn.domain.models import JobListing, PriorityTier, VelocityRank
from src.acorn.domain.signals import Signal, SignalStatus
from src.acorn.domain.velocity import is_reposted_or_saturated
from src.acorn.interfaces.repository import (
    IActivityRepository,
    IOpportunityRepository,
    ISignalRepository,
)

logger = logging.getLogger("acorn.services.matching")


@dataclass
class MatchingResult:
    """Telemetry report of a personalized matching run."""
    user_id: str
    opportunities_screened: int
    signals_surfaced: list[Signal]
    suppressed_count: int
    matched_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class MatchingService:
    """Evaluates opportunities to produce user-tailored Signals."""

    def __init__(
        self,
        opportunity_repo: IOpportunityRepository,
        signal_repo: ISignalRepository,
        activity_repo: IActivityRepository,
    ):
        self.opportunity_repo = opportunity_repo
        self.signal_repo = signal_repo
        self.activity_repo = activity_repo

    def evaluate_user(
        self,
        user: User,
        candidates: Optional[list[JobListing]] = None,
    ) -> MatchingResult:
        """
        Screens candidates against the user's specific target roles,
        locations, and velocity criteria, surfacing qualifying Signals.
        """
        if candidates is None:
            candidates = self.opportunity_repo.list_recent(limit=150)

        existing_signals = self.signal_repo.list_signals_for_user(user.id, limit=200)
        seen_fps = {s.job.fingerprint for s in existing_signals if s.job}

        prefs = user.preferences
        roles = prefs.target_roles
        surfaced: list[Signal] = []
        suppressed = 0

        for job in candidates:
            if job.fingerprint in seen_fps:
                continue

            # 1. Role-Title Token Alignment
            if not is_relevant_title(job_title=job.title, user_roles=roles):
                suppressed += 1
                continue

            # 2. Strict Canadian Jurisdiction & True-Remote Geofencing
            is_valid_geo, tier, badge = validate_canadian_and_remote_eligibility(
                location_text=job.location,
                is_remote_query=prefs.allow_remote_canada,
                default_tier=job.priority_tier or 2,
            )
            if not is_valid_geo:
                suppressed += 1
                continue

            job.priority_tier = tier
            job.priority_badge = badge

            # 3. Saturation & Reposted Suppression
            if is_reposted_or_saturated(job.description, job.applicant_count) or job.is_reposted:
                suppressed += 1
                continue

            if job.velocity_rank == int(VelocityRank.SATURATED_OR_DROPPED):
                suppressed += 1
                continue

            # 4. Synthesize Fit Score and Grounded Fit Rationale
            fit_score = 70
            fit_reasons = []

            if tier == int(PriorityTier.CORE_GTA):
                fit_score += 15
                fit_reasons.append("Prime location: Core GTA (Mississauga/Toronto)")
            elif tier == int(PriorityTier.OUTER_GTA):
                fit_score += 10
                fit_reasons.append("Greater Toronto Area location")
            elif tier == int(PriorityTier.REMOTE_CANADA):
                fit_score += 10
                fit_reasons.append("Verified Canada-wide remote opening")

            if job.velocity_rank == int(VelocityRank.TIER_A_FIRST_MOVER):
                fit_score += 15
                if job.applicant_count is not None and job.applicant_count_observed:
                    fit_reasons.append(f"First-mover advantage: {job.applicant_count} applicants observed")
                else:
                    fit_reasons.append("Fresh opening: Discovered shortly after posting")
            elif job.velocity_rank == int(VelocityRank.TIER_B_EARLY_WINDOW):
                fit_score += 10
                fit_reasons.append("Early window opportunity")

            fit_reasons.append(f"Direct match with target role: {job.matched_role}")
            fit_score = min(100, max(50, fit_score))

            signal = Signal(
                user_id=user.id,
                job=job,
                status=SignalStatus.UNREAD,
                fit_score=fit_score,
                fit_reasons=fit_reasons,
                velocity_summary=job.velocity_badge,
            )

            self.signal_repo.save_signal(signal)
            surfaced.append(signal)

        # Log Activity Event
        if surfaced or suppressed:
            event = ActivityEvent.create_scan_event(
                user_id=user.id,
                roles_evaluated=len(roles),
                candidates_found=len(candidates),
                signals_surfaced=len(surfaced),
                suppressed_saturated=suppressed,
            )
            self.activity_repo.log_activity(event)

        return MatchingResult(
            user_id=user.id,
            opportunities_screened=len(candidates),
            signals_surfaced=surfaced,
            suppressed_count=suppressed,
        )
