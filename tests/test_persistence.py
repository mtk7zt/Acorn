"""
Unit Tests: SQLite Persistence & Multi-Tenant Repositories
===========================================================
Validates IOpportunityRepository, IUserRepository,
ISignalRepository, and IActivityRepository against SqliteAcornRepository.
"""

from pathlib import Path
import tempfile
import pytest

from src.acorn.domain.activity import ActivityEvent, ActivityType
from src.acorn.domain.identity import ChannelBinding, ChannelType, User, UserPreferences
from src.acorn.domain.models import JobListing, PriorityTier, VelocityRank
from src.acorn.domain.signals import Signal, SignalStatus
from src.acorn.infrastructure.persistence.sqlite_repo import SqliteAcornRepository


@pytest.fixture
def repo():
    """Provides a fresh temporary file-backed SqliteAcornRepository for each test."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        db_file = Path(tmp_dir) / "test_acorn.db"
        yield SqliteAcornRepository(db_path=db_file)


def test_opportunity_persistence_and_deduplication(repo: SqliteAcornRepository):
    job = JobListing(
        id="li_999001",
        title="Junior Cloud Developer",
        company="Acme Cloud Corp",
        location="Toronto, ON",
        job_type="Full-time",
        posted_ago="5m ago",
        description="Python, Docker, AWS",
        url="https://example.com/job/999001",
        source="LinkedIn",
        matched_role="Junior Cloud Developer",
        priority_tier=int(PriorityTier.CORE_GTA),
        priority_badge="🔥 Priority 1 — Core GTA",
        applicant_count=2,
        applicant_count_observed=True,
        velocity_rank=int(VelocityRank.TIER_A_FIRST_MOVER),
        velocity_badge="⚡ FIRST MOVER — <5 Applicants",
        velocity_reason="Observed 2 applicants on LinkedIn",
    )

    repo.save_opportunity(job)

    # Check existence by fingerprint and ID
    assert repo.exists(job.fingerprint) is True
    assert repo.exists(job.id) is True
    assert repo.exists("non_existent_key") is False

    # Retrieve by fingerprint
    fetched = repo.get_by_fingerprint(job.fingerprint)
    assert fetched is not None
    assert fetched.id == "li_999001"
    assert fetched.title == "Junior Cloud Developer"
    assert fetched.applicant_count == 2
    assert fetched.applicant_count_observed is True
    assert fetched.velocity_reason == "Observed 2 applicants on LinkedIn"


def test_user_persistence_and_telegram_lookup(repo: SqliteAcornRepository):
    user = User(
        id="usr_test_alpha",
        display_name="Sarah Seeker",
        email="sarah@example.ca",
        preferences=UserPreferences(
            target_roles=["Junior Python Developer", "IT Analyst"],
            allow_remote_canada=True,
        ),
        channels=[
            ChannelBinding(channel_type=ChannelType.TELEGRAM, address="987654321"),
        ],
    )

    repo.save_user(user)

    # Direct ID lookup
    fetched = repo.get_user("usr_test_alpha")
    assert fetched is not None
    assert fetched.display_name == "Sarah Seeker"
    assert "Junior Python Developer" in fetched.preferences.target_roles

    # Telegram chat lookup
    by_tg = repo.get_user_by_telegram_chat("987654321")
    assert by_tg is not None
    assert by_tg.id == "usr_test_alpha"

    # Non-existent lookup
    assert repo.get_user_by_telegram_chat("999999999") is None


def test_signal_persistence_and_status_transitions(repo: SqliteAcornRepository):
    user = User(id="usr_sig_user", display_name="Test Seeker")
    repo.save_user(user)

    job = JobListing(
        id="jb_111222",
        title="IT Support Technician",
        company="Federal Gov",
        location="Mississauga, ON",
        job_type="Full-time",
        posted_ago="12m ago",
        description="Hardware, networking, Active Directory",
        url="https://jobbank.gc.ca/111222",
        source="Job Bank CA",
        matched_role="IT Support",
        priority_tier=1,
        priority_badge="Priority 1",
    )

    signal = Signal(
        id="sig_test_01",
        user_id="usr_sig_user",
        job=job,
        status=SignalStatus.UNREAD,
        fit_score=94,
        fit_reasons=["Core GTA", "Direct role match"],
    )

    repo.save_signal(signal)

    # List signals for user
    user_signals = repo.list_signals_for_user("usr_sig_user")
    assert len(user_signals) == 1
    assert user_signals[0].id == "sig_test_01"
    assert user_signals[0].job.title == "IT Support Technician"

    # Update status to APPLIED
    ok = repo.update_signal_status("sig_test_01", SignalStatus.APPLIED)
    assert ok is True

    # Filter by status
    applied_signals = repo.list_signals_for_user("usr_sig_user", status=SignalStatus.APPLIED)
    assert len(applied_signals) == 1
    unread_signals = repo.list_signals_for_user("usr_sig_user", status=SignalStatus.UNREAD)
    assert len(unread_signals) == 0


def test_activity_logging_and_purge(repo: SqliteAcornRepository):
    event = ActivityEvent.create_scan_event(
        user_id="usr_purge_test",
        roles_evaluated=5,
        candidates_found=18,
        signals_surfaced=2,
        suppressed_saturated=16,
    )
    repo.log_activity(event)

    logs = repo.list_activity_for_user("usr_purge_test")
    assert len(logs) == 1
    assert "Kept watch" in logs[0].headline

    # Test complete data purge
    purged_count = repo.purge_for_user("usr_purge_test")
    assert purged_count >= 1

    remaining_logs = repo.list_activity_for_user("usr_purge_test")
    assert len(remaining_logs) == 0
