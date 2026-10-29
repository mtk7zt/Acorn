"""
Unit Tests: Decoupled Ingestion, Matching, and Briefing Services
===============================================================
Validates shared background ingestion, personalized opportunity matching,
and MorningBriefing synthesis with mocked scrapers.
"""

from pathlib import Path
import tempfile
import pytest

from src.acorn.application.services.briefing_service import BriefingService
from src.acorn.application.services.ingestion_service import IngestionService
from src.acorn.application.services.matching_service import MatchingService
from src.acorn.domain.identity import ChannelBinding, ChannelType, User, UserPreferences
from src.acorn.domain.models import AppConfig, JobListing, LocationSpec, PriorityTier
from src.acorn.domain.signals import SignalStatus
from src.acorn.infrastructure.persistence.sqlite_repo import SqliteAcornRepository
from src.acorn.interfaces.scraper import BaseJobScraper


class MockScraper(BaseJobScraper):
    """Mock scraper returning deterministic JobListing fixtures."""

    def __init__(self, jobs: list[JobListing]):
        self._jobs = jobs

    @property
    def name(self) -> str:
        return "Mock Board"

    def scrape(self, role: str, location: LocationSpec, max_age_seconds: int) -> list[JobListing]:
        return [j for j in self._jobs if role.lower() in j.matched_role.lower()]


@pytest.fixture
def test_repo():
    with tempfile.TemporaryDirectory() as tmp_dir:
        db_file = Path(tmp_dir) / "test_services.db"
        yield SqliteAcornRepository(db_path=db_file)


def test_end_to_end_services_flow(test_repo: SqliteAcornRepository):
    # 1. Setup mock jobs
    job_junior = JobListing(
        id="job_001",
        title="Junior Software Engineer",
        company="Shopify Canada",
        location="Toronto, ON",
        job_type="Full-time",
        posted_ago="10m ago",
        description="Python, PostgreSQL, Docker",
        url="https://shopify.com/jobs/001",
        source="Mock Board",
        matched_role="Junior Software Engineer",
        priority_tier=1,
        priority_badge="Priority 1",
        applicant_count=3,
        applicant_count_observed=True,
    )
    job_senior = JobListing(
        id="job_002",
        title="Senior Principal Architect",
        company="Enterprise Global",
        location="Toronto, ON",
        job_type="Full-time",
        posted_ago="1h ago",
        description="Architecture, C++",
        url="https://enterprise.com/jobs/002",
        source="Mock Board",
        matched_role="Junior Software Engineer",
        priority_tier=1,
        priority_badge="Priority 1",
    )

    scraper = MockScraper([job_junior, job_senior])

    # 2. Ingest
    ingestion_service = IngestionService(
        scrapers=[scraper],
        opportunity_repo=test_repo,
    )
    ingest_result = ingestion_service.ingest_roles(
        roles=["Junior Software Engineer"],
        locations=[
            LocationSpec(
                name="Toronto",
                indeed_location="Toronto, ON",
                jobbank_location="Toronto",
                is_remote=False,
                default_tier=1,
            )
        ],
    )
    assert ingest_result.new_opportunities_saved == 2
    assert test_repo.exists("job_001") is True

    # 3. Create User with Junior Preferences
    user = User(
        id="usr_service_test",
        display_name="Dev Tester",
        preferences=UserPreferences(
            target_roles=["Junior Software Engineer"],
            allow_remote_canada=True,
        ),
    )
    test_repo.save_user(user)

    # 4. Matching Service
    matching_service = MatchingService(
        opportunity_repo=test_repo,
        signal_repo=test_repo,
        activity_repo=test_repo,
    )
    match_result = matching_service.evaluate_user(user)

    # Senior role should be suppressed, junior role should be surfaced
    assert len(match_result.signals_surfaced) == 1
    sig = match_result.signals_surfaced[0]
    assert sig.job.title == "Junior Software Engineer"
    assert sig.status == SignalStatus.UNREAD
    assert sig.fit_score >= 85
    assert match_result.suppressed_count >= 1

    # 5. Briefing Service
    briefing_service = BriefingService(
        signal_repo=test_repo,
        activity_repo=test_repo,
        opportunity_repo=test_repo,
    )
    briefing = briefing_service.get_latest_briefing(user)
    assert briefing.signal_count == 1
    assert "Junior Software Engineer" in briefing.signals[0].job.title
    summary_text = briefing.to_summary_text()
    assert "Acorn Briefing" in summary_text
    assert "Shopify Canada" in summary_text
