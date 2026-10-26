#!/usr/bin/env python3
"""
Multi-Board Instant Job Tracker Bot for Telegram (GitHub Actions Ready)
=======================================================================
Tracks newly posted jobs (past 10–60 minutes) across:
  1. LinkedIn (Direct Guest API + JobSpy)
  2. Indeed Canada
  3. Job Bank Canada (jobbank.gc.ca — Government of Canada official job board)
  4. Glassdoor Canada
  5. Google Jobs Canada (aggregates Workopolis, Monster.ca, Eluta, & employer sites)

Each Telegram Alert Includes:
  - Priority Tier Badge (Mississauga/Toronto -> Surrounding GTA -> Remote Canada)
  - Job Title, Company Name & Exact Location
  - Mini Description (clean 2–3 sentence summary of key responsibilities/requirements)
  - Direct Clickable Job URL + One-Tap [🚀 Apply] Button
  - Interactive [➕ Add Job Role] and [📋 Manage Roles] Buttons
"""

from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
import html
import json
import logging
import os
from pathlib import Path
import re
import time
from typing import Any
from urllib.parse import quote_plus, urljoin

from bs4 import BeautifulSoup
import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("job_tracker")

# ---------------------------------------------------------------------------
# 1. Default Target Roles, Locations & Configuration
# ---------------------------------------------------------------------------

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

SEARCH_LOCATIONS: list[dict[str, Any]] = [
    {
        "name": "Mississauga, Ontario, Canada",
        "indeed_location": "Mississauga, ON",
        "jobbank_location": "Mississauga (ON)",
        "is_remote": False,
        "default_tier": 1,
    },
    {
        "name": "Toronto, Ontario, Canada",
        "indeed_location": "Toronto, ON",
        "jobbank_location": "Toronto (ON)",
        "is_remote": False,
        "default_tier": 1,
    },
    {
        "name": "Greater Toronto Area, Canada",
        "indeed_location": "Greater Toronto Area, ON",
        "jobbank_location": "Toronto (ON)",
        "is_remote": False,
        "default_tier": 2,
    },
    {
        "name": "Canada",
        "indeed_location": "Remote",
        "jobbank_location": "Canada",
        "is_remote": True,
        "default_tier": 3,
    },
]

PRIORITY_1_KEYWORDS: tuple[str, ...] = (
    "mississauga",
    "toronto",
    "etobicoke",
    "north york",
    "scarborough",
    "east york",
    "york",
)

PRIORITY_2_KEYWORDS: tuple[str, ...] = (
    "brampton",
    "oakville",
    "burlington",
    "milton",
    "vaughan",
    "woodbridge",
    "markham",
    "richmond hill",
    "thornhill",
    "pickering",
    "ajax",
    "whitby",
    "oshawa",
    "newmarket",
    "aurora",
    "caledon",
    "halton",
    "peel",
    "durham",
    "hamilton",
    "greater toronto",
    "gta",
)

EXCLUDED_SENIOR_KEYWORDS: tuple[str, ...] = (
    "senior",
    "sr.",
    "sr ",
    "staff",
    "principal",
    "director",
    "vp ",
    "vice president",
    "head of",
    "architect",
    "manager",
    "lead",
)

JUNIOR_OVERRIDE_KEYWORDS: tuple[str, ...] = (
    "junior",
    "jr",
    "intern",
    "internship",
    "co-op",
    "coop",
    "entry",
    "associate",
    "graduate",
    "level 1",
    "tier 1",
    "l1",
)

MAX_AGE_SECONDS: int = int(os.getenv("MAX_AGE_SECONDS", "3600"))
SEEN_JOBS_FILE = Path(os.getenv("SEEN_JOBS_FILE", "seen_jobs.json"))
ROLES_CONFIG_FILE = Path(os.getenv("ROLES_CONFIG_FILE", "roles_config.json"))
SEEN_RETENTION_DAYS = 7

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/128.0.0.0 Safari/537.36"
)


# ---------------------------------------------------------------------------
# 2. Dynamic Role Configuration & Telegram Button State (roles_config.json)
# ---------------------------------------------------------------------------

def load_roles_config(filepath: Path = ROLES_CONFIG_FILE) -> dict[str, Any]:
    """
    Loads active target roles and last processed Telegram update_id from JSON.
    Initializes with DEFAULT_TARGET_ROLES if the file does not exist yet.
    """
    default_cfg: dict[str, Any] = {
        "roles": list(DEFAULT_TARGET_ROLES),
        "last_update_id": 0,
        "awaiting_role_input": False,
    }
    if not filepath.exists():
        save_roles_config(default_cfg, filepath)
        return default_cfg

    try:
        data = json.loads(filepath.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            return default_cfg
        roles = data.get("roles")
        if not isinstance(roles, list) or not roles:
            roles = list(DEFAULT_TARGET_ROLES)
        return {
            "roles": [str(r).strip() for r in roles if str(r).strip()],
            "last_update_id": int(data.get("last_update_id", 0)),
            "awaiting_role_input": bool(data.get("awaiting_role_input", False)),
        }
    except Exception as exc:
        logger.warning("Could not load %s (%s); using defaults.", filepath, exc)
        return default_cfg


def save_roles_config(cfg: dict[str, Any], filepath: Path = ROLES_CONFIG_FILE) -> None:
    """Saves active target roles and Telegram offset state to JSON."""
    filepath.write_text(
        json.dumps(cfg, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def add_roles_to_config(
    cfg: dict[str, Any],
    raw_input: str,
) -> list[str]:
    """
    Adds one or more comma-separated roles to `cfg["roles"]` (case-insensitive deduplication).
    Returns the list of newly added roles.
    """
    existing_lower = {r.lower() for r in cfg["roles"]}
    added: list[str] = []
    for candidate in raw_input.split(","):
        clean = candidate.strip()
        if clean and clean.lower() not in existing_lower:
            cfg["roles"].append(clean)
            existing_lower.add(clean.lower())
            added.append(clean)
    return added


def remove_role_from_config(cfg: dict[str, Any], target_role: str) -> bool:
    """Removes a role by exact case-insensitive match or 1-based index."""
    target_clean = target_role.strip()
    if not target_clean:
        return False

    if target_clean.isdigit():
        idx = int(target_clean) - 1
        if 0 <= idx < len(cfg["roles"]):
            cfg["roles"].pop(idx)
            return True

    for i, existing in enumerate(cfg["roles"]):
        if existing.lower() == target_clean.lower():
            cfg["roles"].pop(i)
            return True
    return False


# ---------------------------------------------------------------------------
# 3. Priority Classification, Title Filtering & Mini Description Builder
# ---------------------------------------------------------------------------

def classify_location_priority(location_text: str, is_remote: bool, default_tier: int) -> tuple[int, str]:
    """
    Returns (priority_tier, badge_label):
      1 -> Priority 1 (Mississauga / Toronto)
      2 -> Priority 2 (Surrounding GTA)
      3 -> Priority 3 (Remote)
    """
    loc_lower = (location_text or "").lower()

    if any(k in loc_lower for k in PRIORITY_1_KEYWORDS):
        return 1, "🔥 Priority 1 — Mississauga / Toronto"
    if any(k in loc_lower for k in PRIORITY_2_KEYWORDS):
        return 2, "📍 Priority 2 — Surrounding GTA"
    if is_remote or "remote" in loc_lower or "telework" in loc_lower or default_tier == 3:
        return 3, "🌐 Priority 3 — Remote (Canada)"
    if default_tier == 1:
        return 1, "🔥 Priority 1 — Mississauga / Toronto"
    return 2, "📍 Priority 2 — Surrounding GTA"


def is_relevant_title(job_title: str) -> bool:
    """Filter out Senior/Lead/Manager roles unless they also mention Junior/Intern/Entry."""
    title_lower = (job_title or "").lower()
    if not title_lower:
        return False

    has_junior_override = any(k in title_lower for k in JUNIOR_OVERRIDE_KEYWORDS)
    if not has_junior_override and any(k in title_lower for k in EXCLUDED_SENIOR_KEYWORDS):
        return False

    return True


def clean_mini_description(raw_text: str | None, fallback: str = "") -> str:
    """
    Cleans raw HTML/Markdown job descriptions into a crisp, readable
    2–3 sentence (~260 character) mini description for Telegram.
    """
    if not raw_text or str(raw_text).strip().lower() in ("nan", "none", ""):
        return fallback or "Click the direct job link below to view full responsibilities and apply."

    # Strip any HTML tags if present
    text = BeautifulSoup(str(raw_text), "html.parser").get_text(" ", strip=True)
    # Remove markdown formatting symbols and collapse whitespace
    text = re.sub(r"[*_`#>-]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()

    if not text:
        return fallback or "Click the direct job link below to view full responsibilities and apply."

    max_len = 260
    if len(text) <= max_len:
        return text

    truncated = text[:max_len].rsplit(" ", 1)[0].rstrip(".,;:")
    return f"{truncated}..."


def parse_relative_age_seconds(posted_text: str) -> int | None:
    """
    Parses strings like '8 minutes ago', '1 hour ago', 'Just now', '35m ago'
    into approximate age in seconds. Returns None if unknown.
    """
    if not posted_text:
        return None
    text = posted_text.strip().lower()
    if any(phrase in text for phrase in ("just now", "just posted", "moments ago")):
        return 60

    match = re.search(r"(\d+)\s*(second|sec|s|minute|min|m|hour|hr|h|day|d)", text)
    if not match:
        return None

    value = int(match.group(1))
    unit = match.group(2)
    if unit.startswith("s"):
        return value
    if unit.startswith("m"):
        return value * 60
    if unit.startswith("h"):
        return value * 3600
    if unit.startswith("d"):
        return value * 86400
    return None


# ---------------------------------------------------------------------------
# 4. Deduplication State Management (seen_jobs.json)
# ---------------------------------------------------------------------------

def load_seen_jobs(filepath: Path) -> dict[str, str]:
    """Load seen job IDs mapped to ISO timestamps, pruning entries older than 7 days."""
    if not filepath.exists():
        return {}
    try:
        data = json.loads(filepath.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            return {}
        cutoff = datetime.now(timezone.utc) - timedelta(days=SEEN_RETENTION_DAYS)
        cleaned: dict[str, str] = {}
        for job_id, ts_str in data.items():
            try:
                ts = datetime.fromisoformat(ts_str)
                if ts.tzinfo is None:
                    ts = ts.replace(tzinfo=timezone.utc)
                if ts >= cutoff:
                    cleaned[job_id] = ts_str
            except ValueError:
                continue
        return cleaned
    except Exception as exc:
        logger.warning("Could not read %s (%s); starting fresh.", filepath, exc)
        return {}


def save_seen_jobs(filepath: Path, seen: dict[str, str]) -> None:
    """Persist seen job IDs to JSON."""
    filepath.write_text(
        json.dumps(seen, indent=2, sort_keys=True),
        encoding="utf-8",
    )


# ---------------------------------------------------------------------------
# 5. Multi-Source Job Engines: LinkedIn, Indeed, Job Bank CA, Glassdoor, Google
# ---------------------------------------------------------------------------

def fetch_linkedin_job_snippet(numeric_job_id: str) -> str:
    """Fetches a concise mini description from LinkedIn's guest job detail endpoint."""
    if not numeric_job_id or not numeric_job_id.isdigit():
        return ""
    detail_url = f"https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{numeric_job_id}"
    headers = {"User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9"}
    try:
        resp = requests.get(detail_url, headers=headers, timeout=10)
        if resp.status_code != 200:
            return ""
        soup = BeautifulSoup(resp.text, "html.parser")
        desc_el = soup.find("div", class_=re.compile(r"show-more-less-html__markup|description__text"))
        if desc_el:
            return clean_mini_description(desc_el.get_text(" ", strip=True))
    except Exception:
        pass
    return ""


def fetch_linkedin_guest_jobs(
    role: str,
    location_cfg: dict[str, Any],
    max_age_seconds: int = MAX_AGE_SECONDS,
) -> list[dict[str, Any]]:
    """
    Queries LinkedIn's public Guest Jobs endpoint with `f_TPR=r{max_age_seconds}`
    (e.g., r3600 = past 1 hour) and extracts minute-level posting times + mini description.
    """
    jobs: list[dict[str, Any]] = []
    keywords_encoded = quote_plus(role)
    location_encoded = quote_plus(location_cfg["name"])

    remote_param = "&f_WT=2" if location_cfg["is_remote"] else ""
    url = (
        "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search"
        f"?keywords={keywords_encoded}"
        f"&location={location_encoded}"
        f"&f_TPR=r{max_age_seconds}"
        f"{remote_param}"
        "&sortBy=DD&start=0"
    )

    headers = {
        "User-Agent": USER_AGENT,
        "Accept-Language": "en-US,en;q=0.9",
    }

    try:
        resp = requests.get(url, headers=headers, timeout=15)
        if resp.status_code != 200 or not resp.text.strip():
            return jobs

        soup = BeautifulSoup(resp.text, "html.parser")
        cards = soup.find_all("li")

        for card in cards:
            base_card = card.find("div", class_=re.compile(r"base-card"))
            title_el = card.find("h3", class_=re.compile(r"base-search-card__title"))
            company_el = card.find("h4", class_=re.compile(r"base-search-card__subtitle"))
            loc_el = card.find("span", class_=re.compile(r"job-search-card__location"))
            time_el = card.find("time")
            link_el = card.find("a", class_=re.compile(r"base-card__full-link"))

            if not title_el or not link_el:
                continue

            title = title_el.get_text(strip=True)
            if not is_relevant_title(title):
                continue

            company = company_el.get_text(strip=True) if company_el else "Unknown Company"
            location_str = loc_el.get_text(strip=True) if loc_el else location_cfg["name"]
            raw_url = link_el.get("href", "").split("?")[0].strip()
            if not raw_url:
                continue

            entity_urn = base_card.get("data-entity-urn", "") if base_card else ""
            urn_match = re.search(r"(\d+)$", entity_urn)
            numeric_id = urn_match.group(1) if urn_match else ""
            job_id = f"li_{numeric_id}" if numeric_id else f"li_{raw_url}"

            posted_text = time_el.get_text(strip=True) if time_el else "Within the past hour"
            age_sec = parse_relative_age_seconds(posted_text)
            if age_sec is not None and age_sec > max_age_seconds:
                continue

            tier, badge = classify_location_priority(
                location_str,
                location_cfg["is_remote"],
                location_cfg["default_tier"],
            )

            snippet = fetch_linkedin_job_snippet(numeric_id)
            if not snippet:
                snippet = f"Newly posted {title} opening at {company} ({location_str}) matching {role}."

            jobs.append(
                {
                    "id": job_id,
                    "title": title,
                    "company": company,
                    "location": location_str,
                    "job_type": "Full-time / Part-time / Contract",
                    "posted_ago": posted_text,
                    "description": snippet,
                    "url": raw_url,
                    "source": "LinkedIn",
                    "matched_role": role,
                    "priority_tier": tier,
                    "priority_badge": badge,
                }
            )
    except Exception as exc:
        logger.debug("LinkedIn guest fetch warning for '%s' (%s): %s", role, location_cfg["name"], exc)

    return jobs


def fetch_jobbank_detail_snippet(job_url: str) -> str:
    """Fetches a brief description/salary/overview snippet from a Job Bank CA posting."""
    headers = {"User-Agent": USER_AGENT, "Accept-Language": "en-CA,en;q=0.9"}
    try:
        resp = requests.get(job_url, headers=headers, timeout=10)
        if resp.status_code != 200:
            return ""
        soup = BeautifulSoup(resp.text, "html.parser")
        desc_el = (
            soup.find(attrs={"property": "description"})
            or soup.find("div", class_=re.compile(r"job-posting-detail-requirements|job-posting-brief"))
        )
        if desc_el:
            return clean_mini_description(desc_el.get_text(" ", strip=True))
    except Exception:
        pass
    return ""


def fetch_jobbank_ca_jobs(
    role: str,
    location_cfg: dict[str, Any],
) -> list[dict[str, Any]]:
    """
    Queries Government of Canada's official Job Bank (`jobbank.gc.ca`),
    sorted by newest date (`sort=D`), and extracts newly posted matching jobs.
    """
    jobs: list[dict[str, Any]] = []
    keywords_encoded = quote_plus(role)
    loc_encoded = quote_plus(location_cfg["jobbank_location"])

    remote_filter = "&fwhcl=R" if location_cfg["is_remote"] else ""
    url = (
        "https://www.jobbank.gc.ca/jobsearch/jobsearch"
        f"?searchstring={keywords_encoded}"
        f"&locationstring={loc_encoded}"
        "&sort=D"
        f"{remote_filter}"
    )

    headers = {
        "User-Agent": USER_AGENT,
        "Accept-Language": "en-CA,en;q=0.9",
    }

    try:
        resp = requests.get(url, headers=headers, timeout=15)
        if resp.status_code != 200 or not resp.text.strip():
            return jobs

        soup = BeautifulSoup(resp.text, "html.parser")
        articles = soup.find_all("article")

        today_str = datetime.now().strftime("%B %d, %Y").lower()
        today_short = datetime.now().strftime("%b %d").lower()

        for article in articles[:15]:
            link_el = article.find("a", href=re.compile(r"/jobsearch/jobposting/"))
            if not link_el:
                continue

            title_el = article.find("span", class_=re.compile(r"noctitle"))
            title = title_el.get_text(strip=True) if title_el else link_el.get_text(" ", strip=True)
            if not is_relevant_title(title):
                continue

            company_el = article.find("li", class_=re.compile(r"business"))
            company = company_el.get_text(strip=True) if company_el else "Canadian Employer"

            loc_el = article.find("li", class_=re.compile(r"location"))
            if loc_el:
                raw_loc = loc_el.get_text(" ", strip=True)
                location_str = re.sub(r"^Location\s*", "", raw_loc, flags=re.IGNORECASE).strip()
            else:
                location_str = location_cfg["jobbank_location"]

            salary_el = article.find("li", class_=re.compile(r"salary"))
            salary_str = ""
            if salary_el:
                raw_sal = salary_el.get_text(" ", strip=True)
                salary_str = re.sub(r"^Salary\s*:?\s*", "", raw_sal, flags=re.IGNORECASE).strip()

            date_el = article.find("li", class_=re.compile(r"date"))
            posted_text = date_el.get_text(strip=True) if date_el else "Today"

            posted_lower = posted_text.lower()
            if (
                posted_lower
                and today_str not in posted_lower
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

            tier, badge = classify_location_priority(
                location_str,
                location_cfg["is_remote"],
                location_cfg["default_tier"],
            )

            detail_snippet = fetch_jobbank_detail_snippet(full_url)
            if not detail_snippet:
                sal_note = f" Compensation: {salary_str}." if salary_str else ""
                detail_snippet = (
                    f"Official Job Bank Canada listing for {title} at {company} in {location_str}.{sal_note}"
                )

            jobs.append(
                {
                    "id": job_id,
                    "title": title,
                    "company": company,
                    "location": location_str,
                    "job_type": "Full-time / Part-time / Contract",
                    "posted_ago": f"New on Job Bank ({posted_text})",
                    "description": detail_snippet,
                    "url": full_url,
                    "source": "Job Bank CA",
                    "matched_role": role,
                    "priority_tier": tier,
                    "priority_badge": badge,
                }
            )
    except Exception as exc:
        logger.debug("Job Bank CA fetch warning for '%s' (%s): %s", role, location_cfg["jobbank_location"], exc)

    return jobs


def fetch_jobspy_jobs(
    role: str,
    location_cfg: dict[str, Any],
) -> list[dict[str, Any]]:
    """
    Uses `python-jobspy` to query Indeed Canada, LinkedIn, Glassdoor Canada,
    and Google Jobs (which aggregates Workopolis, Monster.ca, Eluta, etc.)
    for listings posted within the past 1 hour (`hours_old=1`).
    """
    try:
        from jobspy import scrape_jobs
    except ImportError:
        logger.debug("python-jobspy not installed; skipping JobSpy engine.")
        return []

    jobs: list[dict[str, Any]] = []
    try:
        df = scrape_jobs(
            site_name=["indeed", "linkedin", "glassdoor", "google"],
            search_term=role,
            location=location_cfg["indeed_location"],
            results_wanted=20,
            hours_old=1,
            country_indeed="Canada",
            is_remote=location_cfg["is_remote"],
            verbose=0,
        )
        if df is None or df.empty:
            return []

        for _, row in df.iterrows():
            title = str(row.get("title") or "").strip()
            if not is_relevant_title(title):
                continue

            company = str(row.get("company") or "Unknown Company").strip()
            location_str = str(row.get("location") or location_cfg["indeed_location"]).strip()
            job_url = str(row.get("job_url") or "").strip()
            if not job_url or job_url == "nan":
                continue

            site_raw = str(row.get("site") or "indeed").strip().lower()
            site_labels = {
                "indeed": "Indeed CA",
                "linkedin": "LinkedIn",
                "glassdoor": "Glassdoor CA",
                "google": "Google Jobs CA",
            }
            site = site_labels.get(site_raw, site_raw.capitalize())
            raw_id = str(row.get("id") or job_url).strip()
            job_id = f"{site_raw}_{raw_id}"

            raw_job_type = str(row.get("job_type") or "").strip()
            if not raw_job_type or raw_job_type.lower() in ("nan", "none"):
                raw_job_type = "Full-time / Part-time / Contract"

            raw_desc = row.get("description")
            mini_desc = clean_mini_description(
                str(raw_desc) if raw_desc is not None else "",
                fallback=f"New {title} role at {company} in {location_str} ({raw_job_type}).",
            )

            is_remote_flag = bool(row.get("is_remote")) or location_cfg["is_remote"]
            tier, badge = classify_location_priority(
                location_str,
                is_remote_flag,
                location_cfg["default_tier"],
            )

            jobs.append(
                {
                    "id": job_id,
                    "title": title,
                    "company": company,
                    "location": location_str,
                    "job_type": raw_job_type,
                    "posted_ago": "Posted within the last hour",
                    "description": mini_desc,
                    "url": job_url,
                    "source": site,
                    "matched_role": role,
                    "priority_tier": tier,
                    "priority_badge": badge,
                }
            )
    except Exception as exc:
        logger.debug("JobSpy warning for '%s' in '%s': %s", role, location_cfg["indeed_location"], exc)

    return jobs


# ---------------------------------------------------------------------------
# 6. Telegram Notification & Interactive Role Management Buttons
# ---------------------------------------------------------------------------

def build_interactive_keyboard(job_url: str | None = None, source_name: str = "Job Board") -> dict[str, Any]:
    """
    Builds the Telegram inline keyboard attached to alerts and control menus:
      - Row 1 (if job_url): [🚀 Apply on <Source>]
      - Row 2: [➕ Add Job Role]  [📋 Manage Roles]
    """
    rows: list[list[dict[str, str]]] = []
    if job_url:
        rows.append(
            [
                {
                    "text": f"🚀 Apply on {source_name}",
                    "url": job_url,
                }
            ]
        )
    rows.append(
        [
            {"text": "➕ Add Job Role", "callback_data": "add_role_prompt"},
            {"text": "📋 Manage Roles", "callback_data": "list_roles"},
        ]
    )
    return {"inline_keyboard": rows}


def format_telegram_message(job: dict[str, Any]) -> str:
    """
    Formats a single job listing into clean Telegram HTML including:
      - Priority Badge
      - Job Title, Company & Location
      - Mini Description (2–3 sentences)
      - Direct Clickable URL
    """
    badge = html.escape(job["priority_badge"])
    title = html.escape(job["title"])
    company = html.escape(job["company"])
    location = html.escape(job["location"])
    job_type = html.escape(job["job_type"])
    posted_ago = html.escape(job["posted_ago"])
    source = html.escape(job["source"])
    matched_role = html.escape(job["matched_role"])
    mini_desc = html.escape(
        clean_mini_description(
            job.get("description"),
            fallback=f"New {job['title']} opening at {job['company']} ({job['location']}).",
        )
    )
    url = html.escape(job["url"])

    return (
        f"<b>{badge}</b>\n\n"
        f"💼 <b>{title}</b>\n"
        f"🏢 <b>Company:</b> {company}\n"
        f"📍 <b>Location:</b> {location}\n"
        f"🕒 <b>Posted:</b> {posted_ago}  |  📋 <b>Type:</b> {job_type}\n"
        f"🔎 <b>Source:</b> {source} <i>({matched_role})</i>\n\n"
        f"📝 <b>Mini Description:</b>\n{mini_desc}\n\n"
        f"🔗 <b>Direct Job Link:</b> <a href=\"{url}\">{url}</a>"
    )


def send_telegram_message(
    bot_token: str,
    chat_id: str,
    text: str,
    reply_markup: dict[str, Any] | None = None,
) -> bool:
    """Sends an HTML message with optional inline keyboard or ForceReply to Telegram."""
    api_url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload: dict[str, Any] = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": False,
    }
    if reply_markup:
        payload["reply_markup"] = reply_markup

    try:
        response = requests.post(api_url, json=payload, timeout=15)
        if response.status_code == 200:
            return True
        logger.error("Telegram API error (%s): %s", response.status_code, response.text)
        return False
    except Exception as exc:
        logger.error("Failed to send Telegram message: %s", exc)
        return False


def send_telegram_alert(
    bot_token: str,
    chat_id: str,
    job: dict[str, Any],
) -> bool:
    """Sends a formatted job alert with Apply + Add Role buttons to Telegram."""
    return send_telegram_message(
        bot_token=bot_token,
        chat_id=chat_id,
        text=format_telegram_message(job),
        reply_markup=build_interactive_keyboard(job["url"], job["source"]),
    )


def answer_callback_query(bot_token: str, callback_query_id: str, text: str = "") -> None:
    """Acknowledges a Telegram inline button tap."""
    api_url = f"https://api.telegram.org/bot{bot_token}/answerCallbackQuery"
    try:
        requests.post(
            api_url,
            json={"callback_query_id": callback_query_id, "text": text},
            timeout=10,
        )
    except Exception:
        pass


def send_roles_management_menu(bot_token: str, chat_id: str, cfg: dict[str, Any]) -> None:
    """Sends the current list of tracked job roles with one-tap remove buttons."""
    roles = cfg["roles"]
    numbered = "\n".join(f"  {i + 1}. <b>{html.escape(r)}</b>" for i, r in enumerate(roles))
    text = (
        "📋 <b>Currently Tracked Job Roles</b>\n"
        "<i>(Checked across LinkedIn, Indeed CA, Job Bank CA, Glassdoor & Google Jobs)</i>\n\n"
        f"{numbered}\n\n"
        "💡 <b>How to update roles anytime:</b>\n"
        "• Tap <b>➕ Add Job Role</b> below and reply with new title(s)\n"
        "• Or send <code>/add QA Analyst, Cloud Support</code>\n"
        "• Or send <code>/remove Helpdesk</code> (or tap a remove button below)"
    )

    inline_rows: list[list[dict[str, str]]] = [
        [{"text": "➕ Add Job Role", "callback_data": "add_role_prompt"}]
    ]
    for idx in range(max(0, len(roles) - 6), len(roles)):
        role_label = roles[idx]
        short_label = role_label[:24]
        inline_rows.append(
            [{"text": f"❌ Remove: {short_label}", "callback_data": f"rm_idx:{idx + 1}"}]
        )

    send_telegram_message(
        bot_token=bot_token,
        chat_id=chat_id,
        text=text,
        reply_markup={"inline_keyboard": inline_rows},
    )


def process_telegram_updates(
    bot_token: str,
    chat_id: str,
    cfg: dict[str, Any],
) -> bool:
    """
    Polls Telegram `getUpdates` to process any button taps ([➕ Add Job Role],
    [📋 Manage Roles], [❌ Remove]) and text commands (`/add`, `/remove`, `/roles`,
    or direct replies to the Add Role prompt).
    Returns True if `cfg` was modified.
    """
    offset = int(cfg.get("last_update_id", 0)) + 1
    api_url = f"https://api.telegram.org/bot{bot_token}/getUpdates"
    modified = False

    try:
        resp = requests.get(
            api_url,
            params={"offset": offset, "timeout": 2},
            timeout=10,
        )
        if resp.status_code != 200:
            return False

        payload = resp.json()
        updates = payload.get("result", [])
        if not updates:
            return False

        for upd in updates:
            upd_id = int(upd["update_id"])
            cfg["last_update_id"] = max(int(cfg.get("last_update_id", 0)), upd_id)
            modified = True

            # 1) Handle Inline Button Taps (callback_query)
            cb = upd.get("callback_query")
            if cb:
                cb_id = cb.get("id", "")
                cb_data = cb.get("data", "")
                cb_chat_id = str(cb.get("message", {}).get("chat", {}).get("id", ""))

                if cb_chat_id and cb_chat_id != str(chat_id):
                    continue

                if cb_data == "add_role_prompt":
                    cfg["awaiting_role_input"] = True
                    answer_callback_query(bot_token, cb_id, "Send the new job role(s) in chat!")
                    send_telegram_message(
                        bot_token=bot_token,
                        chat_id=chat_id,
                        text=(
                            "➕ <b>Add New Job Role(s)</b>\n\n"
                            "Reply with the job title(s) you want to add "
                            "(separate multiple roles with a comma, e.g. "
                            "<code>System Administrator, Junior DevOps Engineer</code>):"
                        ),
                        reply_markup={"force_reply": True, "selective": True},
                    )
                elif cb_data == "list_roles":
                    answer_callback_query(bot_token, cb_id, "Loading tracked roles...")
                    send_roles_management_menu(bot_token, chat_id, cfg)
                elif cb_data.startswith("rm_idx:"):
                    idx_str = cb_data.split(":", 1)[1]
                    if remove_role_from_config(cfg, idx_str):
                        answer_callback_query(bot_token, cb_id, "Role removed!")
                        send_roles_management_menu(bot_token, chat_id, cfg)
                    else:
                        answer_callback_query(bot_token, cb_id, "Could not remove role.")
                continue

            # 2) Handle Text Messages & Commands (/add, /remove, /roles, or reply to prompt)
            msg = upd.get("message")
            if not msg:
                continue

            msg_chat_id = str(msg.get("chat", {}).get("id", ""))
            if msg_chat_id and msg_chat_id != str(chat_id):
                continue

            text = (msg.get("text") or "").strip()
            if not text:
                continue

            reply_to_text = (msg.get("reply_to_message", {}).get("text") or "")
            is_reply_to_add_prompt = "Add New Job Role" in reply_to_text

            if text.lower().startswith("/add"):
                raw_roles = re.sub(r"^/add(@\S+)?\s*", "", text, flags=re.IGNORECASE).strip()
                if not raw_roles:
                    cfg["awaiting_role_input"] = True
                    send_telegram_message(
                        bot_token=bot_token,
                        chat_id=chat_id,
                        text=(
                            "➕ Please reply with the job title(s) you want to add "
                            "(e.g., <code>QA Analyst, Technical Support Tier 2</code>):"
                        ),
                        reply_markup={"force_reply": True, "selective": True},
                    )
                else:
                    added = add_roles_to_config(cfg, raw_roles)
                    cfg["awaiting_role_input"] = False
                    if added:
                        added_str = ", ".join(f"<b>{html.escape(r)}</b>" for r in added)
                        send_telegram_message(
                            bot_token=bot_token,
                            chat_id=chat_id,
                            text=(
                                f"✅ Added new job role(s): {added_str}\n"
                                f"Now tracking <b>{len(cfg['roles'])}</b> roles across LinkedIn, "
                                "Indeed CA, Job Bank CA, Glassdoor & Google Jobs!"
                            ),
                            reply_markup=build_interactive_keyboard(),
                        )
                    else:
                        send_telegram_message(
                            bot_token=bot_token,
                            chat_id=chat_id,
                            text="ℹ️ Those role(s) are already in your active tracking list.",
                            reply_markup=build_interactive_keyboard(),
                        )

            elif text.lower().startswith("/remove") or text.lower().startswith("/delete"):
                target = re.sub(r"^/(remove|delete)(@\S+)?\s*", "", text, flags=re.IGNORECASE).strip()
                if remove_role_from_config(cfg, target):
                    send_telegram_message(
                        bot_token=bot_token,
                        chat_id=chat_id,
                        text=f"🗑️ Removed <b>{html.escape(target)}</b> from your tracked roles.",
                        reply_markup=build_interactive_keyboard(),
                    )
                else:
                    send_telegram_message(
                        bot_token=bot_token,
                        chat_id=chat_id,
                        text=(
                            f"⚠️ Could not find <code>{html.escape(target)}</code>. "
                            "Tap <b>📋 Manage Roles</b> to view or remove active roles."
                        ),
                        reply_markup=build_interactive_keyboard(),
                    )

            elif text.lower().startswith("/roles") or text.lower().startswith("/list") or text.lower().startswith("/start"):
                send_roles_management_menu(bot_token, chat_id, cfg)

            elif cfg.get("awaiting_role_input") or is_reply_to_add_prompt:
                added = add_roles_to_config(cfg, text)
                cfg["awaiting_role_input"] = False
                if added:
                    added_str = ", ".join(f"<b>{html.escape(r)}</b>" for r in added)
                    send_telegram_message(
                        bot_token=bot_token,
                        chat_id=chat_id,
                        text=(
                            f"✅ Added new job role(s): {added_str}\n"
                            f"Now tracking <b>{len(cfg['roles'])}</b> roles across LinkedIn, "
                            "Indeed CA, Job Bank CA, Glassdoor & Google Jobs!"
                        ),
                        reply_markup=build_interactive_keyboard(),
                    )
                else:
                    send_telegram_message(
                        bot_token=bot_token,
                        chat_id=chat_id,
                        text="ℹ️ Role(s) already tracked! Tap <b>📋 Manage Roles</b> to see your full list.",
                        reply_markup=build_interactive_keyboard(),
                    )

    except Exception as exc:
        logger.debug("Telegram update polling warning: %s", exc)

    return modified


# ---------------------------------------------------------------------------
# 7. Main Orchestration Loop
# ---------------------------------------------------------------------------

def collect_fresh_jobs(roles: list[str], seen: dict[str, str]) -> list[dict[str, Any]]:
    """
    Polls LinkedIn, Indeed Canada, Job Bank Canada (jobbank.gc.ca),
    Glassdoor Canada, and Google Jobs across all active roles and priority tiers.
    """
    discovered: dict[str, dict[str, Any]] = {}

    for location_cfg in SEARCH_LOCATIONS:
        for role in roles:
            logger.info("Checking [%s] in [%s]...", role, location_cfg["indeed_location"])

            # 1) LinkedIn Guest API (10m–1h minute-level freshness)
            for job in fetch_linkedin_guest_jobs(role, location_cfg):
                jid = job["id"]
                if jid not in seen and jid not in discovered:
                    discovered[jid] = job

            # 2) Job Bank Canada (jobbank.gc.ca official listings)
            for job in fetch_jobbank_ca_jobs(role, location_cfg):
                jid = job["id"]
                if jid not in seen and jid not in discovered:
                    discovered[jid] = job

            # 3) JobSpy Multi-Board (Indeed CA, LinkedIn, Glassdoor CA, Google Jobs CA)
            for job in fetch_jobspy_jobs(role, location_cfg):
                jid = job["id"]
                if jid not in seen and jid not in discovered:
                    discovered[jid] = job

            time.sleep(0.8)

    # Sort strictly by Location Priority (1 = Mississauga/Toronto, 2 = GTA, 3 = Remote)
    return sorted(discovered.values(), key=lambda x: x["priority_tier"])


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Multi-Board Telegram Job Tracker (LinkedIn, Indeed, Job Bank CA, Glassdoor, Google Jobs)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate configuration and print sample alert without sending to Telegram.",
    )
    parser.add_argument(
        "--test-telegram",
        action="store_true",
        help="Send a sample test notification with interactive [➕ Add Job Role] buttons to Telegram.",
    )
    parser.add_argument(
        "--add-role",
        type=str,
        default="",
        help="Add one or more comma-separated job roles to roles_config.json.",
    )
    parser.add_argument(
        "--remove-role",
        type=str,
        default="",
        help="Remove a job role from roles_config.json.",
    )
    parser.add_argument(
        "--listen",
        action="store_true",
        help="Run in continuous interactive mode (polls Telegram buttons every 3s and checks jobs every 10m).",
    )
    args = parser.parse_args()

    roles_cfg = load_roles_config(ROLES_CONFIG_FILE)

    if args.add_role.strip():
        added = add_roles_to_config(roles_cfg, args.add_role)
        save_roles_config(roles_cfg, ROLES_CONFIG_FILE)
        logger.info("Added roles via CLI: %s", added)

    if args.remove_role.strip():
        removed = remove_role_from_config(roles_cfg, args.remove_role)
        save_roles_config(roles_cfg, ROLES_CONFIG_FILE)
        logger.info("Removed role '%s': %s", args.remove_role, removed)

    if args.dry_run:
        sample_job = {
            "id": "jobbank_999999",
            "title": "Junior Software Engineer (Java / AWS)",
            "company": "Example Tech Corp",
            "location": "Mississauga, ON",
            "job_type": "Full-time",
            "posted_ago": "12 minutes ago",
            "description": (
                "Join our engineering team in Mississauga to build and maintain Java microservices on AWS, "
                "collaborate on REST APIs, and support cloud deployments. Ideal for recent CS graduates or entry-level developers."
            ),
            "url": "https://www.jobbank.gc.ca/jobsearch/jobposting/999999",
            "source": "Job Bank CA",
            "matched_role": "Junior Software Engineer",
            "priority_tier": 1,
            "priority_badge": "🔥 Priority 1 — Mississauga / Toronto",
        }
        kb = build_interactive_keyboard(sample_job["url"], sample_job["source"])
        logger.info(
            "Dry-run mode succeeded.\nActive roles (%d): %s\nSample Telegram HTML:\n%s\nInline Keyboard: %s",
            len(roles_cfg["roles"]),
            roles_cfg["roles"],
            format_telegram_message(sample_job),
            json.dumps(kb),
        )
        return

    bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "").strip()

    if not bot_token or not chat_id:
        raise SystemExit(
            "ERROR: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID environment variables must be set."
        )

    # Process any queued Telegram button clicks ([➕ Add Job Role], [📋 Manage Roles], /add, /remove)
    if process_telegram_updates(bot_token, chat_id, roles_cfg):
        save_roles_config(roles_cfg, ROLES_CONFIG_FILE)

    if args.test_telegram:
        sample_job = {
            "id": "test_notification",
            "title": "✅ Multi-Board Job Tracker Connected!",
            "company": "LinkedIn • Indeed CA • Job Bank CA • Glassdoor • Google Jobs",
            "location": "Mississauga / Toronto -> GTA -> Remote",
            "job_type": "Full-time / Part-time / Contract / Intern",
            "posted_ago": "Just now",
            "description": (
                "Your job tracker is active! Every alert includes the company name, exact location, "
                "a concise mini description of the role, and the direct job link so you can apply right away."
            ),
            "url": "https://www.jobbank.gc.ca/jobsearch/jobsearch",
            "source": "Job Bank CA",
            "matched_role": f"{len(roles_cfg['roles'])} Active Roles",
            "priority_tier": 1,
            "priority_badge": "🔥 Priority 1 — Mississauga / Toronto",
        }
        ok = send_telegram_alert(bot_token, chat_id, sample_job)
        if ok:
            logger.info("Test Telegram alert with interactive role buttons sent!")
        else:
            raise SystemExit("Failed to send test Telegram alert.")
        return

    if args.listen:
        logger.info("Starting continuous interactive mode (Telegram button listener + 10m job scan)...")
        last_scan = 0.0
        while True:
            if process_telegram_updates(bot_token, chat_id, roles_cfg):
                save_roles_config(roles_cfg, ROLES_CONFIG_FILE)
            now = time.time()
            if now - last_scan >= 600:
                seen = load_seen_jobs(SEEN_JOBS_FILE)
                fresh_jobs = collect_fresh_jobs(roles_cfg["roles"], seen)
                now_iso = datetime.now(timezone.utc).isoformat()
                for job in fresh_jobs:
                    if send_telegram_alert(bot_token, chat_id, job):
                        seen[job["id"]] = now_iso
                        time.sleep(0.5)
                save_seen_jobs(SEEN_JOBS_FILE, seen)
                last_scan = time.time()
            time.sleep(3.0)

    seen = load_seen_jobs(SEEN_JOBS_FILE)
    logger.info(
        "Loaded %d seen jobs and %d active roles.",
        len(seen),
        len(roles_cfg["roles"]),
    )

    fresh_jobs = collect_fresh_jobs(roles_cfg["roles"], seen)
    logger.info("Found %d new matching jobs.", len(fresh_jobs))

    now_iso = datetime.now(timezone.utc).isoformat()
    sent_count = 0

    for job in fresh_jobs:
        if send_telegram_alert(bot_token, chat_id, job):
            seen[job["id"]] = now_iso
            sent_count += 1
            time.sleep(0.5)

    save_seen_jobs(SEEN_JOBS_FILE, seen)
    save_roles_config(roles_cfg, ROLES_CONFIG_FILE)
    logger.info("Sent %d alerts and saved state.", sent_count)


if __name__ == "__main__":
    main()