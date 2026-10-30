"""
Job Tracking Pipeline (GoF Facade Pattern)
===========================================
Coordinates multi-board ingestion, strict title token alignment, Canadian geofencing,
applicant velocity ranking, and dual-key canonical deduplication.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
import logging
import time

from src.acorn.domain.filtering import is_relevant_title
from src.acorn.domain.geofence import validate_canadian_and_remote_eligibility
from src.acorn.domain.models import AppConfig, JobListing, PriorityTier, VelocityRank
from src.acorn.domain.velocity import is_reposted_or_saturated
from src.acorn.interfaces.notifier import BaseNotifier
from src.acorn.interfaces.scraper import BaseJobScraper
from src.acorn.interfaces.storage import BaseStateStore

logger = logging.getLogger("acorn.pipeline")


@dataclass
class PipelineSummary:
    """Summary of batch pipeline execution metrics."""
    active_roles_count: int
    scraped_candidates_count: int
    new_jobs_found: int
    alerts_transmitted: int
    paused: bool = False
    failed_sources: list[str] = field(default_factory=list)
    successful_sources: list[str] = field(default_factory=list)


class JobTrackingPipeline:
    """Enterprise orchestrator coordinating multi-board job tracking."""

    def __init__(
        self,
        scrapers: list[BaseJobScraper],
        store: BaseStateStore,
        notifier: BaseNotifier,
        config: AppConfig,
    ):
        self.scrapers = scrapers
        self.store = store
        self.notifier = notifier
        self.config = config

    def run(
        self,
        dry_run: bool = False,
        custom_roles: list[str] | None = None,
        user_id: str | None = None,
    ) -> PipelineSummary:
        """Executes full batch harvesting and alert workflow enforcing all 4 mandatory rules."""
        if not self.config.cron_enabled and not dry_run:
            logger.info("Pipeline execution is PAUSED in bot_config.json ('cron_enabled': false). Exiting.")
            return PipelineSummary(0, 0, 0, 0, paused=True)

        roles_cfg = self.store.load_roles_config()
        if custom_roles:
            roles = [r.strip() for r in custom_roles if r.strip()]
        else:
            roles = roles_cfg.get("roles", [])

        # Load global seen store for discovery caching
        global_seen = self.store.load_seen_jobs()

        # If running for a specific user, load their private seen history
        user_seen = self.store.load_user_seen_jobs(user_id) if user_id else {}

        logger.info(
            "Initiating Acorn Pipeline: %d roles, %d global keys cached, %d user seen keys (user_id=%s).",
            len(roles),
            len(global_seen),
            len(user_seen),
            user_id or "global",
        )

        discovered: dict[str, JobListing] = {}
        failed_sources: set[str] = set()
        successful_sources: set[str] = set()

        for loc in self.config.search_locations:
            for role in roles:
                logger.info("Polling role [%s] in location [%s]...", role, loc.name)

                for scraper in self.scrapers:
                    try:
                        candidates = scraper.scrape(role, loc, self.config.max_age_seconds)
                        successful_sources.add(scraper.name)
                        for job in candidates:
                            # 1. Rule 3: Strict Role-Title Token Alignment & Non-Tech False Positive Blocking
                            if not is_relevant_title(job.title, user_roles=roles):
                                logger.debug("Suppressed non-relevant/senior title: %s", job.title)
                                continue

                            # 2. Rule 4: Strict Canadian Jurisdiction & True-Remote Geofencing
                            is_valid_geo, tier, badge = validate_canadian_and_remote_eligibility(
                                location_text=job.location,
                                is_remote_query=loc.is_remote,
                                default_tier=loc.default_tier,
                            )
                            if not is_valid_geo:
                                logger.debug("Suppressed non-Canadian or false-remote location: %s (%s)", job.location, job.title)
                                continue

                            job.priority_tier = tier
                            job.priority_badge = badge

                            # 3. Rule 1: First-Mover Velocity & Reposted/Saturation Filter (>40 applicants)
                            if is_reposted_or_saturated(job.description, job.applicant_count) or job.is_reposted:
                                logger.debug("Suppressed saturated/reposted listing: %s (applicants: %s)", job.title, job.applicant_count)
                                continue

                            if job.velocity_rank == int(VelocityRank.SATURATED_OR_DROPPED):
                                continue

                            # 4. Rule 2: Dual-Key Canonical Deduplication
                            # In user-targeted mode: global seen does NOT suppress! Only suppress if THIS user already received it.
                            # In scheduled/global mode: global seen suppresses duplicate alerts.
                            if user_id:
                                if (job.id in user_seen) or (job.fingerprint in user_seen):
                                    logger.debug("Deduplicated job by user-seen key: id=%s fp=%s for user=%s", job.id, job.fingerprint, user_id)
                                    continue
                            else:
                                if (job.id in global_seen) or (job.fingerprint in global_seen):
                                    logger.debug("Deduplicated job by global seen key: id=%s fp=%s", job.id, job.fingerprint)
                                    continue

                            if (job.id in discovered) or (job.fingerprint in discovered):
                                continue

                            # Store by unique fingerprint in discovered batch
                            discovered[job.fingerprint] = job

                    except Exception as exc:
                        failed_sources.add(scraper.name)
                        logger.error("Error executing scraper %s for role %s: %s", scraper.name, role, exc)

                time.sleep(0.5)

        # Sort strictly by (priority_tier, velocity_rank, age_seconds) so <5 applicant Priority-1 jobs arrive first!
        sorted_jobs = sorted(
            discovered.values(),
            key=lambda j: (j.priority_tier, j.velocity_rank, j.age_seconds)
        )
        logger.info("Scraping completed. Discovered %d unnotified qualifying jobs.", len(sorted_jobs))

        alerts_sent = 0
        now_iso = datetime.now(timezone.utc).isoformat()

        if not dry_run:
            for job in sorted_jobs:
                if self.notifier.send_alert(job):
                    alerts_sent += 1
                    # Record keys in global seen store for ingestion tracking
                    global_seen[job.id] = now_iso
                    global_seen[job.fingerprint] = now_iso

                    # Record keys in user-specific seen store if targeted
                    if user_id:
                        user_seen[job.id] = now_iso
                        user_seen[job.fingerprint] = now_iso

                    time.sleep(0.5)

            # Atomically save global state
            self.store.save_seen_jobs(global_seen)

            # Atomically save user state if targeted
            if user_id:
                self.store.save_user_seen_jobs(user_id, user_seen)

            if not custom_roles:
                self.store.save_roles_config(roles_cfg)
            logger.info("State successfully updated: %d alerts dispatched.", alerts_sent)
        else:
            logger.info("Dry-run mode: suppressed dispatching %d alerts.", len(sorted_jobs))

        return PipelineSummary(
            active_roles_count=len(roles),
            scraped_candidates_count=len(discovered),
            new_jobs_found=len(sorted_jobs),
            alerts_transmitted=alerts_sent,
            paused=False,
            failed_sources=sorted(list(failed_sources)),
            successful_sources=sorted(list(successful_sources)),
        )
