"""
Unit Tests: Canadian Geofencing & True-Remote Validation
"""

import pytest
from src.acorn.domain.geofence import validate_canadian_and_remote_eligibility


def test_core_gta_priority_1():
    is_valid, tier, badge = validate_canadian_and_remote_eligibility("Mississauga, ON")
    assert is_valid is True
    assert tier == 1
    assert "Priority 1" in badge


def test_outer_gta_priority_2():
    is_valid, tier, badge = validate_canadian_and_remote_eligibility("Brampton, Ontario, Canada")
    assert is_valid is True
    assert tier == 2
    assert "Priority 2" in badge


def test_true_remote_priority_3():
    is_valid, tier, badge = validate_canadian_and_remote_eligibility(
        "Remote, Canada", is_remote_query=True, default_tier=3
    )
    assert is_valid is True
    assert tier == 3
    assert "Priority 3" in badge


def test_foreign_location_blocked():
    is_valid, _, _ = validate_canadian_and_remote_eligibility("New York, NY, United States")
    assert is_valid is False

    is_valid, _, _ = validate_canadian_and_remote_eligibility("Bengaluru, India")
    assert is_valid is False

    is_valid, _, _ = validate_canadian_and_remote_eligibility("London, UK")
    assert is_valid is False


def test_us_state_suffix_blocked():
    # San Francisco, CA (California) without Canada marker must be blocked
    is_valid, _, _ = validate_canadian_and_remote_eligibility("San Francisco, CA")
    assert is_valid is False

    is_valid, _, _ = validate_canadian_and_remote_eligibility("Austin, TX")
    assert is_valid is False

    is_valid, _, _ = validate_canadian_and_remote_eligibility("Seattle, WA")
    assert is_valid is False


def test_non_gta_onsite_suppressed_on_remote_search():
    # An on-site role in Calgary or Vancouver without remote confirmation must be rejected on remote search
    is_valid, _, _ = validate_canadian_and_remote_eligibility(
        "Calgary, AB, Canada", is_remote_query=True, default_tier=3
    )
    assert is_valid is False
