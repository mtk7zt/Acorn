"""
Unit Tests: Acorn Core Multi-Tenant Domain Entities
===================================================
Validates Tenant, User, UserPreferences, ChannelBinding,
Signal, MorningBriefing, and ActivityEvent domain models.
"""

import pytest
from src.acorn.domain.identity import ChannelBinding, ChannelType, Tenant, User, UserPreferences
from src.acorn.domain.models import JobListing, PriorityTier, VelocityRank
from src.acorn.domain.signals import MorningBriefing, Signal, SignalStatus
from src.acorn.domain.activity import ActivityEvent, ActivityType


def test_user_creation_and_channel_binding():
    user = User(
        display_name="Dev Tester",
        email="dev@example.com",
    )
    assert user.id.startswith("usr_")
    assert user.tenant_id == "tenant_default"
    assert len(user.preferences.target_roles) > 0

    # Add Telegram channel binding
    binding = ChannelBinding(
        channel_type=ChannelType.TELEGRAM,
        address="123456789",
    )
    user.channels.append(binding)

    assert user.get_telegram_chat_id() == "123456789"


def test_signal_lifecycle_and_actions():
    job = JobListing(
        id="test_sig_job",
        title="Junior Cloud Developer",
        company="Acme Cloud Corp",
        location="Toronto, ON",
        job_type="Full-time",
        posted_ago="10m ago",
        description="Looking for Python, Docker, AWS.",
        url="https://example.com/job",
        source="LinkedIn",
        matched_role="Junior Cloud Developer",
        priority_tier=int(PriorityTier.CORE_GTA),
        priority_badge="🔥 Priority 1 — Core GTA",
        applicant_count=3,
        applicant_count_observed=True,
    )

    signal = Signal(
        user_id="usr_001",
        job=job,
        fit_score=92,
        fit_reasons=["Direct title match", "First-mover <5 applicants", "Core GTA location"],
    )

    assert signal.id.startswith("sig_")
    assert signal.status == SignalStatus.UNREAD
    assert signal.job.applicant_count_observed is True

    # Mark viewed
    signal.mark_viewed()
    assert signal.status == SignalStatus.VIEWED

    # Mark applied
    signal.mark_applied()
    assert signal.status == SignalStatus.APPLIED
    assert signal.user_action_at is not None


def test_morning_briefing_synthesis():
    job1 = JobListing(
        id="j1",
        title="Junior Python Dev",
        company="Tech Canada",
        location="Mississauga, ON",
        job_type="Full-time",
        posted_ago="15m ago",
        description="Python & SQL",
        url="https://example.com/j1",
        source="Job Bank CA",
        matched_role="Junior Python Dev",
        priority_tier=1,
        priority_badge="Priority 1",
        applicant_count=2,
    )
    sig1 = Signal(user_id="usr_001", job=job1, fit_score=95)

    briefing = MorningBriefing(
        user_id="usr_001",
        signals=[sig1],
        scanned_roles_count=12,
        suppressed_count=40,
    )

    assert briefing.signal_count == 1
    text = briefing.to_summary_text()
    assert "Acorn Briefing" in text
    assert "Junior Python Dev" in text
    assert "Mississauga, ON" in text


def test_activity_event_audit_trail():
    event = ActivityEvent.create_scan_event(
        user_id="usr_001",
        roles_evaluated=10,
        candidates_found=25,
        signals_surfaced=3,
        suppressed_saturated=22,
    )
    assert event.id.startswith("act_")
    assert event.event_type == ActivityType.SCAN_COMPLETED
    assert "Kept watch across Canadian job boards" in event.headline
    assert event.details["signals_surfaced"] == 3
