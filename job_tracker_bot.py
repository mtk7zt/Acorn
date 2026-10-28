#!/usr/bin/env python3
"""
Acorn Multi-Board Canadian Job Tracker (CLI Facade)
===================================================
Orchestration entrypoint coordinating:
  1. LinkedIn Guest API (Minute-level freshness & velocity metrics)
  2. Indeed Canada
  3. Job Bank Canada (jobbank.gc.ca official portal)
  4. Glassdoor Canada
  5. Google Jobs Canada (Workopolis, Monster, Eluta)
"""

from __future__ import annotations

import argparse
import logging
import os
from pathlib import Path
import sys

# Ensure src package is importable
current_dir = Path(__file__).resolve().parent
if str(current_dir) not in sys.path:
    sys.path.insert(0, str(current_dir))

from src.acorn.application.config import ConfigurationManager
from src.acorn.application.pipeline import JobTrackingPipeline
from src.acorn.domain.models import JobListing, PriorityTier, VelocityRank
from src.acorn.infrastructure.notifiers.telegram import TelegramNotifier
from src.acorn.infrastructure.scrapers.factory import ScraperFactory
from src.acorn.infrastructure.storage.json_store import AtomicJsonStateStore

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("acorn.cli")

DEFAULT_TARGET_ROLES: list[str] = [
    "Junior Software Engineer",
    "Software Engineer Intern",
    "IT Support",
    "Help Desk",
    "Helpdesk",
    "Application Support Analyst",
    "AWS Cloud Junior Developer",
    "IT Analyst",
    "Customer Support",
    "Customer Tech Support",
    "Junior Cloud Developer",
    "Java Developer",
    "Junior Java Developer",
]

SEEN_JOBS_FILE = Path(os.getenv("SEEN_JOBS_FILE", "seen_jobs.json"))
ROLES_CONFIG_FILE = Path(os.getenv("ROLES_CONFIG_FILE", "roles_config.json"))
BOT_CONFIG_FILE = Path(os.getenv("BOT_CONFIG_FILE", "bot_config.json"))


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Acorn Multi-Board Job Tracker Engine"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Harvest and filter candidate jobs without transmitting Telegram alerts",
    )
    parser.add_argument(
        "--test-telegram",
        action="store_true",
        help="Transmit a sample test notification with interactive 3-row buttons to verify bot connectivity",
    )
    args = parser.parse_args()

    # Load centralized configuration
    config = ConfigurationManager.load_app_config(BOT_CONFIG_FILE)

    # Resolve environment secrets
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "").strip()

    if not bot_token or not chat_id:
        if not args.dry_run:
            raise SystemExit("ERROR: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID environment variables must be configured.")
        logger.warning("TELEGRAM credentials missing; executing in dry-run mode.")

    # Initialize Object-Oriented Components via Dependency Injection
    state_store = AtomicJsonStateStore(
        seen_jobs_path=SEEN_JOBS_FILE,
        roles_config_path=ROLES_CONFIG_FILE,
        default_roles=DEFAULT_TARGET_ROLES,
    )
    notifier = TelegramNotifier(bot_token=bot_token, chat_id=chat_id)
    scrapers = ScraperFactory.create_default_scrapers(config)

    pipeline = JobTrackingPipeline(
        scrapers=scrapers,
        store=state_store,
        notifier=notifier,
        config=config,
    )

    # 1. Handle Connectivity Test Request
    if args.test_telegram or os.getenv("TEST_TELEGRAM", "false").lower() == "true":
        roles_cfg = state_store.load_roles_config()
        sample_job = JobListing(
            id="test_notification",
            title="✅ Acorn Multi-Board Job Tracker Connected!",
            company="LinkedIn • Indeed CA • Job Bank CA • Glassdoor • Google Jobs",
            location="Mississauga / Toronto -> GTA -> Remote",
            job_type="Full-time / Part-time / Contract / Intern",
            posted_ago="Just now",
            description=(
                "Your Acorn AI job tracker is active! Catching newly posted roles within minutes with "
                "first-mover applicant velocity tagging, strict Canadian geofencing, and zero-PII ATS resume matching."
            ),
            url="https://www.jobbank.gc.ca/jobsearch/jobsearch",
            source="Job Bank CA",
            matched_role=f"{len(roles_cfg['roles'])} Active Roles",
            priority_tier=int(PriorityTier.CORE_GTA),
            priority_badge="🔥 Priority 1 — Mississauga / Toronto",
            applicant_count=3,
            velocity_rank=int(VelocityRank.TIER_A_FIRST_MOVER),
            velocity_badge="⚡ FIRST MOVER — <5 Applicants / Fresh",
            is_reposted=False,
            age_seconds=180,
        )
        ok = notifier.send_alert(sample_job)
        if ok:
            logger.info("Test alert successfully delivered to Telegram with 3-row keyboard!")
        else:
            raise SystemExit("Failed to dispatch test notification to Telegram.")
        return

    # 2. Execute Full Batch Pipeline
    summary = pipeline.run(dry_run=args.dry_run)
    if summary.paused:
        logger.info("Pipeline completed early: execution is paused.")
    else:
        logger.info(
            "Batch execution complete: %d active roles evaluated, %d candidate jobs discovered, %d alerts transmitted.",
            summary.active_roles_count,
            summary.scraped_candidates_count,
            summary.alerts_transmitted,
        )


if __name__ == "__main__":
    main()