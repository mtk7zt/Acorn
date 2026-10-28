"""
First-Mover Applicant Velocity Tiers
====================================
Evaluates live applicant numbers and publication freshness to classify
job openings into first-mover velocity tiers (Tier A, Tier B, Tier C, Dropped).
"""

from __future__ import annotations

import re
from src.acorn.domain.models import VelocityRank

MAX_APPLICANTS = 40
FIRST_MOVER_APPLICANT_THRESHOLD = 5


def parse_applicant_count(raw_text: str | None) -> int | None:
    """Parses applicant counts from text like '4 applicants', 'Over 100 applicants', 'Less than 5 applicants'."""
    if not raw_text:
        return None

    text = raw_text.lower()
    if "less than 5" in text or "under 5" in text or "first 25" in text:
        return 4

    match = re.search(r"(\d+)\s+applicant", text)
    if match:
        return int(match.group(1))

    return None


def is_reposted_or_saturated(raw_text: str | None, applicant_count: int | None = None) -> bool:
    """
    Returns True if listing is reposted or has exceeded the maximum applicant threshold (>40).
    """
    if applicant_count is not None and applicant_count > MAX_APPLICANTS:
        return True

    if raw_text:
        lower = raw_text.lower()
        if "reposted" in lower or "re-posted" in lower:
            return True
        if "over 100 applicants" in lower or "over 200 applicants" in lower:
            return True

    return False


def classify_applicant_velocity(
    applicant_count: int | None,
    age_seconds: int = 1800,
    raw_status_text: str = "",
) -> tuple[int, str]:
    """
    Classifies applicant velocity into tiers:
      Tier A (Rank 1): ⚡ FIRST MOVER — <5 Applicants / Just Posted <10m
      Tier B (Rank 2): 🟢 Early Window — 5 to 25 Applicants
      Tier C (Rank 3): 🟡 Active Window — 26 to 40 Applicants
      Dropped (Rank 4): Saturated (>40 applicants or Reposted)
    """
    status_lower = (raw_status_text or "").lower()

    # Reposted or >40 applicants check
    if is_reposted_or_saturated(raw_status_text, applicant_count):
        return int(VelocityRank.SATURATED_OR_DROPPED), "🔴 Saturated / Reposted"

    # Tier A check: <5 applicants OR under 10 minutes OR explicit LinkedIn badge
    if (
        (applicant_count is not None and applicant_count < FIRST_MOVER_APPLICANT_THRESHOLD)
        or (age_seconds <= 600)
        or ("less than 5 applicants" in status_lower)
        or ("be among the first 25" in status_lower)
    ):
        return int(VelocityRank.TIER_A_FIRST_MOVER), "⚡ FIRST MOVER — <5 Applicants / Fresh"

    # Tier B check: 5 to 25 applicants (or 10 to 30 min)
    if (
        (applicant_count is not None and 5 <= applicant_count <= 25)
        or (600 < age_seconds <= 1800)
    ):
        return int(VelocityRank.TIER_B_EARLY_WINDOW), "🟢 Early Window — 5-25 Applicants"

    # Tier C check: 26 to 40 applicants (or up to 60 min)
    if (
        (applicant_count is not None and 26 <= applicant_count <= MAX_APPLICANTS)
        or (1800 < age_seconds <= 3600)
    ):
        return int(VelocityRank.TIER_C_ACTIVE_WINDOW), "🟡 Active Window — 26-40 Applicants"

    return int(VelocityRank.TIER_B_EARLY_WINDOW), "🟢 Early Window"
