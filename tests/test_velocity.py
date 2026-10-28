"""
Unit Tests: First-Mover Velocity Tiers & Reposted/Saturation Suppression
"""

import pytest
from src.acorn.domain.velocity import (
    classify_applicant_velocity,
    is_reposted_or_saturated,
    parse_applicant_count,
)
from src.acorn.domain.models import VelocityRank


def test_parse_applicant_count():
    assert parse_applicant_count("3 applicants") == 3
    assert parse_applicant_count("Over 25 applicants") == 25
    assert parse_applicant_count("Be among the first 25 applicants") == 4
    assert parse_applicant_count("Less than 5 applicants") == 4
    assert parse_applicant_count("No applicants mentioned") is None


def test_reposted_or_saturated_detection():
    assert is_reposted_or_saturated("Reposted 2 days ago", None) is True
    assert is_reposted_or_saturated("Re-posted opening", 10) is True
    assert is_reposted_or_saturated("Fresh opening", 45) is True  # >40 applicants
    assert is_reposted_or_saturated("Fresh opening", 15) is False # <=40 applicants


def test_velocity_tier_classification():
    # Tier A: <5 applicants or fresh (<10 min)
    rank, badge = classify_applicant_velocity(3, age_seconds=300)
    assert rank == int(VelocityRank.TIER_A_FIRST_MOVER)
    assert "FIRST MOVER" in badge

    # Tier B: 5 to 25 applicants
    rank, badge = classify_applicant_velocity(12, age_seconds=1200)
    assert rank == int(VelocityRank.TIER_B_EARLY_WINDOW)
    assert "Early Window" in badge

    # Tier C: 26 to 40 applicants
    rank, badge = classify_applicant_velocity(35, age_seconds=2400)
    assert rank == int(VelocityRank.TIER_C_ACTIVE_WINDOW)
    assert "Active Window" in badge

    # Saturated / Reposted
    rank, badge = classify_applicant_velocity(55, age_seconds=1200)
    assert rank == int(VelocityRank.SATURATED_OR_DROPPED)
    assert "Saturated" in badge
