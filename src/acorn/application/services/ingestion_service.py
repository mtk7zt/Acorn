"""
Acorn Application: Shared Opportunity Ingestion Service
=======================================================
Orchestrates background harvesting across external job boards
(LinkedIn Guest API, Job Bank Canada, JobSpy multi-board),
executing atomic dual-key deduplication into the canonical repository.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
import logging
import time
from typing import Optional

from src.acorn.domain.models import AppConfig, JobListing, LocationSpec
from src.acorn.interfaces.repository import IOpportunityRepository
from src.acorn.interfaces.scraper import BaseJobScraper

logger = logging.getLogger("acorn.services.ingestion")


@dataclass
class IngestionResult:
    """Telemetry report of an ingestion run."""
    roles_scraped: int
    locations_queried: int
    candidates_found: int
    new_opportunities_saved: int
    duplicates_skipped: int
    duration_seconds: float
    completed_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class IngestionService:
    """Decoupled service executing shared multi-source job ingestion."""

    def __init__(
        self,
        scrapers: list[BaseJobScraper],
        opportunity_repo: IOpportunityRepository,
        config: Optional[AppConfig] = None,
    ):
        self.scrapers = scrapers
        self.opportunity_repo = opportunity_repo
        self.config = config or AppConfig()

    def ingest_roles(
        self,
        roles: list[str],
        locations: Optional[list[LocationSpec]] = None,
        max_age_seconds: Optional[int] = None,
    ) -> IngestionResult:
        """
        Polls configured scrapers for specified roles and persists
        unique canonical opportunities into the database.
        """
        start_time = time.time()
        search_locations = locations or self.config.search_locations
        age_limit = max_age_seconds or self.config.max_age_seconds

        total_candidates = 0
        new_saved = 0
        duplicates = 0

        logger.info(
            "Starting ingestion across %d roles and %d locations...",
            len(roles), len(search_locations)
        )

        for loc in search_locations:
            for role in roles:
                for scraper in self.scrapers:
                    try:
                        candidates = scraper.scrape(role, loc, age_limit)
                        for job in candidates:
                            total_candidates += 1
                            # Check dual-key deduplication
                            if self.opportunity_repo.exists(job.fingerprint) or self.opportunity_repo.exists(job.id):
                                duplicates += 1
                                continue

                            self.opportunity_repo.save_opportunity(job)
                            new_saved += 1
                    except Exception as exc:
                        logger.error(
                            "Scraper %s failed for role [%s] in [%s]: %s",
                            scraper.name, role, loc.name, exc
                        )
                time.sleep(0.2)

        elapsed = time.time() - start_time
        logger.info(
            "Ingestion completed in %.2fs: %d candidates, %d new saved, %d duplicates.",
            elapsed, total_candidates, new_saved, duplicates
        )

        return IngestionResult(
            roles_scraped=len(roles),
            locations_queried=len(search_locations),
            candidates_found=total_candidates,
            new_opportunities_saved=new_saved,
            duplicates_skipped=duplicates,
            duration_seconds=round(elapsed, 2),
        )
