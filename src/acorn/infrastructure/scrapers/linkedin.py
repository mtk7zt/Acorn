"""
LinkedIn Guest API Scraper Strategy
====================================
Implements BaseJobScraper querying LinkedIn's public guest search endpoint
with applicant count parsing, reposted detection, and first-mover velocity tagging.
"""

from __future__ import annotations

import logging
import re
from typing import Any
from urllib.parse import quote_plus

from bs4 import BeautifulSoup
import requests

from src.acorn.domain.models import JobListing, LocationSpec
from src.acorn.domain.velocity import (
    classify_applicant_velocity,
    is_reposted_or_saturated,
    parse_applicant_count,
)
from src.acorn.interfaces.scraper import BaseJobScraper

logger = logging.getLogger("acorn.scrapers.linkedin")

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/128.0.0.0 Safari/537.36"
)


class LinkedInGuestScraper(BaseJobScraper):
    """Scrapes LinkedIn guest search endpoints."""

    def __init__(self, user_agent: str = USER_AGENT):
        self.user_agent = user_agent
        self.headers = {
            "User-Agent": self.user_agent,
            "Accept-Language": "en-US,en;q=0.9",
        }

    @property
    def name(self) -> str:
        return "LinkedIn"

    def _fetch_snippet_and_applicants(self, numeric_job_id: str) -> tuple[str, int | None, bool]:
        """
        Fetches detailed snippet and applicant velocity data from guest posting endpoint:
        Returns: (snippet_text, applicant_count, is_reposted)
        """
        if not numeric_job_id or not numeric_job_id.isdigit():
            return "", None, False

        url = f"https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{numeric_job_id}"
        try:
            resp = requests.get(url, headers=self.headers, timeout=10)
            if resp.status_code != 200:
                return "", None, False
            soup = BeautifulSoup(resp.text, "html.parser")

            full_text = soup.get_text(" ", strip=True).lower()
            is_reposted = "reposted" in full_text or "re-posted" in full_text
            applicant_count = parse_applicant_count(full_text)

            desc_el = soup.find("div", class_=re.compile(r"show-more-less-html__markup|description__text"))
            snippet = desc_el.get_text(" ", strip=True) if desc_el else ""

            return snippet, applicant_count, is_reposted
        except Exception:
            pass
        return "", None, False

    def scrape(
        self,
        role: str,
        location: LocationSpec,
        max_age_seconds: int,
    ) -> list[JobListing]:
        """Queries LinkedIn guest endpoint and parses listings with velocity metrics."""
        jobs: list[JobListing] = []
        kw_enc = quote_plus(role)
        loc_enc = quote_plus(location.name)
        remote_param = "&f_WT=2" if location.is_remote else ""

        url = (
            "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search"
            f"?keywords={kw_enc}"
            f"&location={loc_enc}"
            f"&f_TPR=r{max_age_seconds}"
            f"{remote_param}"
            "&sortBy=DD&start=0"
        )

        try:
            resp = requests.get(url, headers=self.headers, timeout=15)
            if resp.status_code != 200 or not resp.text.strip():
                return jobs

            soup = BeautifulSoup(resp.text, "html.parser")
            cards = soup.find_all("li")

            for card in cards:
                card_text = card.get_text(" ", strip=True)
                base_card = card.find("div", class_=re.compile(r"base-card"))
                title_el = card.find("h3", class_=re.compile(r"base-search-card__title"))
                comp_el = card.find("h4", class_=re.compile(r"base-search-card__subtitle"))
                loc_el = card.find("span", class_=re.compile(r"job-search-card__location"))
                time_el = card.find("time")
                link_el = card.find("a", class_=re.compile(r"base-card__full-link"))

                if not title_el or not link_el:
                    continue

                title = title_el.get_text(strip=True)
                company = comp_el.get_text(strip=True) if comp_el else "Unknown Company"
                loc_str = loc_el.get_text(strip=True) if loc_el else location.name
                raw_url = link_el.get("href", "").split("?")[0].strip()
                if not raw_url:
                    continue

                entity_urn = base_card.get("data-entity-urn", "") if base_card else ""
                urn_match = re.search(r"(\d+)$", entity_urn)
                numeric_id = urn_match.group(1) if urn_match else ""
                job_id = f"li_{numeric_id}" if numeric_id else f"li_{raw_url}"
                posted_text = time_el.get_text(strip=True) if time_el else "Within past hour"

                # Parse card-level applicant cues
                card_applicants = parse_applicant_count(card_text)

                snippet, detail_applicants, is_reposted_detail = self._fetch_snippet_and_applicants(numeric_id)
                final_applicants = detail_applicants if detail_applicants is not None else card_applicants
                is_reposted = is_reposted_detail or ("reposted" in card_text.lower())

                # Check saturation / reposted filter
                if is_reposted_or_saturated(card_text, final_applicants) or is_reposted:
                    logger.debug("Suppressing saturated/reposted LinkedIn job: %s at %s", title, company)
                    continue

                # Estimate age in seconds
                age_sec = 1800
                if "min" in posted_text.lower():
                    m_match = re.search(r"(\d+)", posted_text)
                    if m_match:
                        age_sec = int(m_match.group(1)) * 60
                elif "just" in posted_text.lower() or "moment" in posted_text.lower():
                    age_sec = 120

                velocity_rank, velocity_badge = classify_applicant_velocity(
                    applicant_count=final_applicants,
                    age_seconds=age_sec,
                    raw_status_text=card_text,
                )

                if not snippet:
                    snippet = f"Newly posted {title} opening at {company} ({loc_str}) matching {role}."

                job = JobListing(
                    id=job_id,
                    title=title,
                    company=company,
                    location=loc_str,
                    job_type="Full-time / Part-time / Contract",
                    posted_ago=posted_text,
                    description=snippet,
                    url=raw_url,
                    source=self.name,
                    matched_role=role,
                    priority_tier=location.default_tier,
                    priority_badge="📍 Priority Pending",
                    applicant_count=final_applicants,
                    velocity_rank=velocity_rank,
                    velocity_badge=velocity_badge,
                    is_reposted=is_reposted,
                    age_seconds=age_sec,
                )
                jobs.append(job)

        except Exception as exc:
            logger.debug("LinkedIn scrape warning for '%s' in '%s': %s", role, location.name, exc)

        return jobs
