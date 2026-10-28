"""
JobSpy Multi-Board Scraper Adapter
===================================
Implements BaseJobScraper utilizing the `python-jobspy` aggregator to query
Indeed Canada, LinkedIn, Glassdoor Canada, and Google Jobs with velocity tagging.
"""

from __future__ import annotations

import logging
from typing import Any

from src.acorn.domain.models import JobListing, LocationSpec
from src.acorn.domain.velocity import classify_applicant_velocity
from src.acorn.interfaces.scraper import BaseJobScraper

logger = logging.getLogger("acorn.scrapers.jobspy")


class JobSpyScraper(BaseJobScraper):
    """Adapter wrapping python-jobspy multi-board scraper."""

    @property
    def name(self) -> str:
        return "JobSpy Multi-Board"

    def scrape(
        self,
        role: str,
        location: LocationSpec,
        max_age_seconds: int,
    ) -> list[JobListing]:
        """Queries Indeed, LinkedIn, Glassdoor, and Google via python-jobspy."""
        try:
            from jobspy import scrape_jobs
        except ImportError:
            logger.debug("python-jobspy is not installed; skipping JobSpy adapter.")
            return []

        jobs: list[JobListing] = []
        hours_old = max(1, round(max_age_seconds / 3600))

        try:
            df = scrape_jobs(
                site_name=["indeed", "linkedin", "glassdoor", "google"],
                search_term=role,
                location=location.indeed_location,
                results_wanted=20,
                hours_old=hours_old,
                country_indeed="Canada",
                is_remote=location.is_remote,
                verbose=0,
            )

            if df is None or df.empty:
                return []

            site_labels = {
                "indeed": "Indeed CA",
                "linkedin": "LinkedIn",
                "glassdoor": "Glassdoor CA",
                "google": "Google Jobs CA",
            }

            for _, row in df.iterrows():
                title = str(row.get("title") or "").strip()
                if not title:
                    continue

                company = str(row.get("company") or "Unknown Company").strip()
                loc_str = str(row.get("location") or location.indeed_location).strip()
                job_url = str(row.get("job_url") or "").strip()
                if not job_url or job_url == "nan":
                    continue

                site_raw = str(row.get("site") or "indeed").strip().lower()
                source_label = site_labels.get(site_raw, site_raw.capitalize())
                raw_id = str(row.get("id") or job_url).strip()
                job_id = f"{site_raw}_{raw_id}"

                raw_job_type = str(row.get("job_type") or "").strip()
                if not raw_job_type or raw_job_type.lower() in ("nan", "none"):
                    raw_job_type = "Full-time / Part-time / Contract"

                raw_desc = row.get("description")
                snippet = str(raw_desc) if raw_desc is not None and str(raw_desc).lower() != "nan" else f"New {title} opening at {company} in {loc_str}."

                velocity_rank, velocity_badge = classify_applicant_velocity(
                    applicant_count=None,
                    age_seconds=1200,
                    raw_status_text="Posted within past hour",
                )

                jobs.append(
                    JobListing(
                        id=job_id,
                        title=title,
                        company=company,
                        location=loc_str,
                        job_type=raw_job_type,
                        posted_ago="Posted within past hour",
                        description=snippet,
                        url=job_url,
                        source=source_label,
                        matched_role=role,
                        priority_tier=location.default_tier,
                        priority_badge="📍 Priority Pending",
                        applicant_count=None,
                        velocity_rank=velocity_rank,
                        velocity_badge=velocity_badge,
                        is_reposted=False,
                        age_seconds=1200,
                    )
                )
        except Exception as exc:
            logger.debug("JobSpy scraper warning for '%s' in '%s': %s", role, location.name, exc)

        return jobs
