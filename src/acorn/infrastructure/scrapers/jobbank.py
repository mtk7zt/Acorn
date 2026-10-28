"""
Job Bank Canada Official Portal Scraper Strategy
=================================================
Implements BaseJobScraper querying Government of Canada's Job Bank
(jobbank.gc.ca) with newest date sorting (sort=D) and velocity classification.
"""

from __future__ import annotations

from datetime import datetime
import logging
import re
from urllib.parse import quote_plus, urljoin

from bs4 import BeautifulSoup
import requests

from src.acorn.domain.models import JobListing, LocationSpec
from src.acorn.domain.velocity import classify_applicant_velocity
from src.acorn.interfaces.scraper import BaseJobScraper

logger = logging.getLogger("acorn.scrapers.jobbank")

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/128.0.0.0 Safari/537.36"
)


class JobBankScraper(BaseJobScraper):
    """Scrapes official Government of Canada Job Bank postings."""

    def __init__(self, user_agent: str = USER_AGENT):
        self.user_agent = user_agent
        self.headers = {
            "User-Agent": self.user_agent,
            "Accept-Language": "en-CA,en;q=0.9",
        }

    @property
    def name(self) -> str:
        return "Job Bank CA"

    def _fetch_detail_snippet(self, job_url: str) -> str:
        """Fetches brief description / salary snippet from detail page."""
        try:
            resp = requests.get(job_url, headers=self.headers, timeout=10)
            if resp.status_code != 200:
                return ""
            soup = BeautifulSoup(resp.text, "html.parser")
            desc_el = soup.find(attrs={"property": "description"}) or soup.find(
                "div", class_=re.compile(r"job-posting-detail-requirements|job-posting-brief")
            )
            if desc_el:
                return desc_el.get_text(" ", strip=True)
        except Exception:
            pass
        return ""

    def scrape(
        self,
        role: str,
        location: LocationSpec,
        max_age_seconds: int,
    ) -> list[JobListing]:
        """Queries Job Bank Canada and extracts recent listings."""
        jobs: list[JobListing] = []
        kw_enc = quote_plus(role)
        loc_enc = quote_plus(location.jobbank_location)
        remote_filter = "&fwhcl=R" if location.is_remote else ""

        url = (
            "https://www.jobbank.gc.ca/jobsearch/jobsearch"
            f"?searchstring={kw_enc}"
            f"&locationstring={loc_enc}"
            "&sort=D"
            f"{remote_filter}"
        )

        try:
            resp = requests.get(url, headers=self.headers, timeout=15)
            if resp.status_code != 200 or not resp.text.strip():
                return jobs

            soup = BeautifulSoup(resp.text, "html.parser")
            articles = soup.find_all("article")

            today_full = datetime.now().strftime("%B %d, %Y").lower()
            today_short = datetime.now().strftime("%b %d").lower()

            for article in articles[:15]:
                link_el = article.find("a", href=re.compile(r"/jobsearch/jobposting/"))
                if not link_el:
                    continue

                title_el = article.find("span", class_=re.compile(r"noctitle"))
                title = title_el.get_text(strip=True) if title_el else link_el.get_text(" ", strip=True)

                comp_el = article.find("li", class_=re.compile(r"business"))
                company = comp_el.get_text(strip=True) if comp_el else "Canadian Employer"

                loc_el = article.find("li", class_=re.compile(r"location"))
                if loc_el:
                    loc_str = re.sub(r"^Location\s*", "", loc_el.get_text(" ", strip=True), flags=re.IGNORECASE).strip()
                else:
                    loc_str = location.jobbank_location

                sal_el = article.find("li", class_=re.compile(r"salary"))
                salary_str = ""
                if sal_el:
                    salary_str = re.sub(r"^Salary\s*:?\s*", "", sal_el.get_text(" ", strip=True), flags=re.IGNORECASE).strip()

                date_el = article.find("li", class_=re.compile(r"date"))
                posted_text = date_el.get_text(strip=True) if date_el else "Today"
                posted_lower = posted_text.lower()

                # Temporal freshness guard
                if (
                    posted_lower
                    and today_full not in posted_lower
                    and today_short not in posted_lower
                    and "today" not in posted_lower
                    and "hour" not in posted_lower
                    and "minute" not in posted_lower
                ):
                    continue

                href = link_el.get("href", "").split(";")[0].split("?")[0].strip()
                full_url = urljoin("https://www.jobbank.gc.ca", href)
                id_match = re.search(r"jobposting/(\d+)", full_url)
                job_id = f"jobbank_{id_match.group(1)}" if id_match else f"jobbank_{full_url}"

                detail_snippet = self._fetch_detail_snippet(full_url)
                if not detail_snippet:
                    sal_note = f" Compensation: {salary_str}." if salary_str else ""
                    detail_snippet = f"Official Job Bank Canada listing for {title} at {company} in {loc_str}.{sal_note}"

                age_sec = 600 if ("minute" in posted_lower or "hour" in posted_lower) else 1800
                velocity_rank, velocity_badge = classify_applicant_velocity(
                    applicant_count=None,
                    age_seconds=age_sec,
                    raw_status_text=posted_text,
                )

                jobs.append(
                    JobListing(
                        id=job_id,
                        title=title,
                        company=company,
                        location=loc_str,
                        job_type="Full-time / Part-time / Contract",
                        posted_ago=f"New on Job Bank ({posted_text})",
                        description=detail_snippet,
                        url=full_url,
                        source=self.name,
                        matched_role=role,
                        priority_tier=location.default_tier,
                        priority_badge="📍 Priority Pending",
                        applicant_count=None,
                        velocity_rank=velocity_rank,
                        velocity_badge=velocity_badge,
                        is_reposted=False,
                        age_seconds=age_sec,
                    )
                )
        except Exception as exc:
            logger.debug("Job Bank scrape warning for '%s' in '%s': %s", role, location.name, exc)

        return jobs
