#!/usr/bin/env python3
"""
Acorn AI — First-Mover Canadian Job Tracker & Zero-PII ATS Co-Pilot
===================================================================
Designed to catch newly posted jobs within seconds/minutes of publication so you
can be the very first applicant, while still surfacing active roles up to 40 applicants.

Applicant Velocity Tiers (Displayed on Every Alert):
  - Tier A (⚡ First Mover: 0–5 Applicants / Just Posted): Highest urgency — lets you apply first!
  - Tier B (🟢 Early Window: 6–25 Applicants): Low competition, high interview probability.
  - Tier C (🟡 Active Window: 26–40 Applicants): Moderate competition, still open.
  - Dropped (>40 Applicants or "Reposted"): Automatically filtered out as saturated/stale.

Location Priority Tiers:
  - Priority 1: Mississauga & Toronto, ON
  - Priority 2: Surrounding GTA (Brampton, Oakville, Markham, Vaughan, etc.)
  - Priority 3: Remote (Canada — strictly verified Canadian remote/telework)
"""

from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
import hashlib
import html
import json
import logging
import os
from pathlib import Path
import re
import tempfile
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
logger = logging.getLogger("acorn_ai")

# ---------------------------------------------------------------------------
# 1. Default Target Roles, Locations & Strict Filtering Constants
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
        "indeed_location": "Canada",
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
    "downtown toronto",
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

CANADIAN_JURISDICTION_KEYWORDS: tuple[str, ...] = (
    "canada",
    "ontario",
    ", on",
    "(on)",
    "british columbia",
    ", bc",
    "alberta",
    ", ab",
    "quebec",
    ", qc",
    "manitoba",
    ", mb",
    "saskatchewan",
    ", sk",
    "nova scotia",
    ", ns",
    "new brunswick",
    ", nb",
    "newfoundland",
    "prince edward island",
    "ottawa",
    "waterloo",
    "kitchener",
    "london, on",
    "vancouver",
    "calgary",
    "edmonton",
    "montreal",
    "winnipeg",
    "halifax",
) + PRIORITY_1_KEYWORDS + PRIORITY_2_KEYWORDS

FOREIGN_LOCATION_BLOCKLIST: tuple[str, ...] = (
    "united states",
    "usa",
    "u.s.a",
    "u.s.",
    "india",
    "united kingdom",
    "england",
    "london, uk",
    "poland",
    "germany",
    "brazil",
    "mexico",
    "philippines",
    "pakistan",
    "nigeria",
    "australia",
    "singapore",
    "ireland",
    "france",
    "spain",
    "ukraine",
    "romania",
    "argentina",
    "colombia",
    ", ny",
    ", tx",
    ", fl",
    ", il",
    ", wa",
    ", ma",
    ", ga",
    ", nc",
    ", pa",
    ", oh",
    ", va",
    ", co",
    ", az",
    ", nj",
    "california",
    "new york",
    "texas",
    "bengaluru",
    "bangalore",
    "hyderabad",
    "mumbai",
    "pune",
)

REMOTE_CONFIRMATION_KEYWORDS: tuple[str, ...] = (
    "remote",
    "telework",
    "work from home",
    "wfh",
    "home-based",
    "anywhere in canada",
    "virtual",
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
    "iii",
    "level 3",
    "tier 3",
    "l3",
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
    "new grad",
    "level 1",
    "tier 1",
    "l1",
    "level i",
)

CORE_ROLE_DOMAIN_TOKENS: tuple[str, ...] = (
    "software",
    "developer",
    "engineer",
    "programmer",
    "java",
    "cloud",
    "aws",
    "devops",
    "support",
    "help desk",
    "helpdesk",
    "service desk",
    "deskside",
    "desktop",
    "it ",
    "i.t.",
    "analyst",
    "technical",
    "tech ",
    "application",
    "system",
    "network",
    "qa",
    "quality assurance",
    "frontend",
    "front-end",
    "backend",
    "back-end",
    "fullstack",
    "full-stack",
)

IRRELEVANT_OCCUPATION_BLOCKLIST: tuple[str, ...] = (
    "account executive",
    "sales representative",
    "business development",
    "forklift",
    "warehouse",
    "driver",
    "nurse",
    "registered practical",
    "cashier",
    "barista",
    "cook",
    "chef",
    "janitor",
    "cleaner",
    "real estate",
    "financial advisor",
    "mortgage",
    "collection agent",
    "telemarketer",
)

MAX_AGE_SECONDS: int = int(os.getenv("MAX_AGE_SECONDS", "3600"))
# Upper bound of 40 applicants: prioritizes <5 (First Mover), shows 5-40, drops >40
MAX_APPLICANTS: int = int(os.getenv("MAX_APPLICANTS", "40"))
FIRST_MOVER_APPLICANT_THRESHOLD: int = int(os.getenv("FIRST_MOVER_THRESHOLD", "5"))
LISTEN_SCAN_INTERVAL_SECONDS: int = int(os.getenv("LISTEN_SCAN_INTERVAL_SECONDS", "60"))

SEEN_JOBS_FILE = Path(os.getenv("SEEN_JOBS_FILE", "seen_jobs.json"))
ROLES_CONFIG_FILE = Path(os.getenv("ROLES_CONFIG_FILE", "roles_config.json"))
SEEN_RETENTION_DAYS = 7

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/128.0.0.0 Safari/537.36"
)


# ---------------------------------------------------------------------------
# 2. Atomic JSON Persistence & Dynamic Role State
# ---------------------------------------------------------------------------

def atomic_write_json(filepath: Path, data: Any) -> None:
    """Writes JSON atomically using tempfile + os.replace to prevent corruption."""
    filepath.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(
        dir=str(filepath.parent),
        prefix=f".{filepath.name}.",
        suffix=".tmp",
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, sort_keys=True, ensure_ascii=False)
        os.replace(tmp_path, filepath)
    except Exception:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise


def load_roles_config(filepath: Path = ROLES_CONFIG_FILE) -> dict[str, Any]:
    """Loads active target roles, last update_id, and recent job cache for ATS scoring."""
    default_cfg: dict[str, Any] = {
        "roles": list(DEFAULT_TARGET_ROLES),
        "last_update_id": 0,
        "awaiting_role_input": False,
        "awaiting_ats_input": False,
        "recent_job_context": [],
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
            "awaiting_ats_input": bool(data.get("awaiting_ats_input", False)),
            "recent_job_context": list(data.get("recent_job_context", []))[:5],
        }
    except Exception as exc:
        logger.warning("Could not load %s (%s); using defaults.", filepath, exc)
        return default_cfg


def save_roles_config(cfg: dict[str, Any], filepath: Path = ROLES_CONFIG_FILE) -> None:
    """Atomically saves active target roles and Telegram offset state to JSON."""
    atomic_write_json(filepath, cfg)


def add_roles_to_config(cfg: dict[str, Any], raw_input: str) -> list[str]:
    """Adds one or more comma-separated roles to `cfg["roles"]`."""
    existing_lower = {r.lower() for r in cfg["roles"]}
    added: list[str] = []
    for candidate in raw_input.split(","):
        clean = re.sub(r"[^\w\s/+.-]", "", candidate).strip()[:80]
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
# 3. Canonical Deduplication, First-Mover Applicant Tiers & Geofencing
# ---------------------------------------------------------------------------

def compute_job_fingerprint(company: str, title: str, location: str) -> str:
    """
    Computes a canonical SHA-256 fingerprint across boards so the exact same job
    posted on both LinkedIn and Indeed (or reposted with a new ID) is never sent twice.
    """
    norm_company = re.sub(r"[^a-z0-9]", "", (company or "").lower())
    norm_title = re.sub(r"\(.*?\)|\[.*?\]|-\s*remote.*", "", (title or "").lower())
    norm_title = re.sub(r"[^a-z0-9]", "", norm_title)
    city_token = (location or "").split(",")[0].split("(")[0].strip().lower()
    norm_city = re.sub(r"[^a-z0-9]", "", city_token)

    payload = f"{norm_company}|{norm_title}|{norm_city}"
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]
    return f"fp_{digest}"


def is_relevant_title(job_title: str, active_roles: list[str] | None = None) -> bool:
    """
    Enforces:
      1. No un-overridden Senior/Staff/Principal/Director/Manager/Lead titles.
      2. No blocked non-tech occupations (sales rep, warehouse, driver, etc.).
      3. Strict alignment with target tech/IT/support/cloud/engineering tokens
         or custom user-configured roles.
    """
    title_lower = f" {(job_title or '').lower()} "
    if not title_lower.strip():
        return False

    if any(blocked in title_lower for blocked in IRRELEVANT_OCCUPATION_BLOCKLIST):
        return False

    has_junior_override = any(k in title_lower for k in JUNIOR_OVERRIDE_KEYWORDS)
    if not has_junior_override and any(k in title_lower for k in EXCLUDED_SENIOR_KEYWORDS):
        return False

    if any(token in title_lower for token in CORE_ROLE_DOMAIN_TOKENS):
        return True

    if active_roles:
        for role in active_roles:
            role_words = [w.lower() for w in re.findall(r"[a-zA-Z]{3,}", role)]
            if role_words and all(w in title_lower for w in role_words):
                return True

    return False


def is_reposted_or_saturated(
    raw_text_or_html: str,
    applicant_count: int | None = None,
    max_applicants: int = MAX_APPLICANTS,
) -> bool:
    """
    Returns True if a job listing is a stale repost ("Reposted ...")
    or already has more than `max_applicants` (default: 40) applicants.
    Allows all fresh jobs from 0 (<5 First Mover) up to 40 applicants!
    """
    if applicant_count is not None and applicant_count > max_applicants:
        return True

    text_lower = (raw_text_or_html or "").lower()
    if re.search(r"\breposted\b", text_lower):
        return True

    app_matches = re.findall(
        r"(?:over\s+|more\s+than\s+)?(\d+)\+?\s*(?:applicants|people\s+clicked\s+apply|applications)",
        text_lower,
    )
    for m in app_matches:
        try:
            if int(m) > max_applicants:
                return True
        except ValueError:
            continue

    return False


def classify_applicant_velocity(
    applicant_count: int | None,
    posted_text: str = "",
) -> tuple[int, str]:
    """
    Classifies a job's competition level so the user knows immediately if they are
    among the first <5 applicants, or in the 5–40 applicant window:
      - Rank 1 (⚡ First Mover): <5 applicants or posted within the last 10 minutes
      - Rank 2 (🟢 Early Window): 5–24 applicants ("Be among the first 25 applicants")
      - Rank 3 (🟡 Active Window): 25–40 applicants (Still open, up to 30/40 cap)
    """
    age_sec = parse_relative_age_seconds(posted_text)

    if applicant_count is not None:
        if applicant_count < FIRST_MOVER_APPLICANT_THRESHOLD:
            return (
                1,
                f"⚡ FIRST MOVER ({applicant_count} Applicants — Apply First!)",
            )
        if applicant_count <= 25:
            return (
                2,
                f"🟢 Early Window ({applicant_count} Applicants — Low Competition)",
            )
        return (
            3,
            f"🟡 Active Window ({applicant_count} Applicants — Under {MAX_APPLICANTS} Cap)",
        )

    # When exact applicant count isn't exposed by the board (e.g. Job Bank CA / Indeed),
    # use posting age to highlight jobs posted seconds/minutes ago (<10 mins = 600s)
    if age_sec is not None and age_sec <= 600:
        return (
            1,
            "⚡ FIRST MOVER (Just Posted <10m Ago — Apply First!)",
        )

    return (
        2,
        f"🟢 Fresh Listing (<{MAX_APPLICANTS} Applicants Verified)",
    )


def validate_canadian_and_remote_eligibility(
    title: str,
    location_text: str,
    description_text: str,
    is_remote_query: bool,
) -> bool:
    """
    Prevents foreign postings (e.g. US, India, Europe) from slipping through and
    ensures Priority 3 (Remote) jobs are genuinely Canadian remote roles rather
    than on-site postings in other cities/countries.
    """
    loc_lower = (location_text or "").lower().strip()
    title_lower = (title or "").lower()
    desc_lower = (description_text or "").lower()

    if any(foreign in loc_lower for foreign in FOREIGN_LOCATION_BLOCKLIST):
        return False

    if re.search(r",\s*ca\b", loc_lower) and "canada" not in loc_lower and "ontario" not in loc_lower:
        return False

    is_canadian = any(can_kw in loc_lower for can_kw in CANADIAN_JURISDICTION_KEYWORDS)
    if not is_canadian and loc_lower == "remote":
        is_canadian = "canada" in desc_lower or "ontario" in desc_lower or "canada" in title_lower

    if not is_canadian:
        return False

    in_p1_or_p2 = any(
        k in loc_lower for k in (PRIORITY_1_KEYWORDS + PRIORITY_2_KEYWORDS)
    )
    if not in_p1_or_p2 or is_remote_query:
        combined = f"{title_lower} {loc_lower} {desc_lower[:400]}"
        has_remote_marker = any(rk in combined for rk in REMOTE_CONFIRMATION_KEYWORDS)
        if not in_p1_or_p2 and not has_remote_marker:
            return False

    return True


def classify_location_priority(location_text: str, is_remote: bool, default_tier: int) -> tuple[int, str]:
    """
    Returns (priority_tier, badge_label):
      1 -> Priority 1 (Mississauga / Toronto)
      2 -> Priority 2 (Surrounding GTA)
      3 -> Priority 3 (Remote Canada)
    """
    loc_lower = (location_text or "").lower()

    if any(k in loc_lower for k in PRIORITY_1_KEYWORDS):
        return 1, "🔥 Priority 1 — Mississauga / Toronto"
    if any(k in loc_lower for k in PRIORITY_2_KEYWORDS):
        return 2, "📍 Priority 2 — Surrounding GTA"
    if is_remote or any(rk in loc_lower for rk in REMOTE_CONFIRMATION_KEYWORDS) or default_tier == 3:
        return 3, "🌐 Priority 3 — Remote (Canada)"
    if default_tier == 1:
        return 1, "🔥 Priority 1 — Mississauga / Toronto"
    return 2, "📍 Priority 2 — Surrounding GTA"


def clean_mini_description(raw_text: str | None, fallback: str = "") -> str:
    """Cleans raw HTML/Markdown job descriptions into a 2–3 sentence (~260 char) summary."""
    if not raw_text or str(raw_text).strip().lower() in ("nan", "none", ""):
        return fallback or "Click the direct job link below to view full responsibilities and apply."

    text = BeautifulSoup(str(raw_text), "html.parser").get_text(" ", strip=True)
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
    """Parses relative age strings ('45 seconds ago', '4 minutes ago', '1 hour ago') into seconds."""
    if not posted_text:
        return None
    text = posted_text.strip().lower()
    if any(phrase in text for phrase in ("just now", "just posted", "moments ago", "seconds ago")):
        return 30

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
# 4. Privacy-First Zero-PII ATS & Resume Co-Pilot
# ---------------------------------------------------------------------------

ATS_TECH_SKILLS_VOCAB: tuple[str, ...] = (
    "java", "python", "javascript", "typescript", "sql", "aws", "cloud", "ec2",
    "s3", "lambda", "docker", "kubernetes", "git", "linux", "windows", "active directory",
    "office 365", "microsoft 365", "azure", "jira", "servicenow", "zensdesk",
    "troubleshooting", "help desk", "technical support", "customer support",
    "rest api", "microservices", "spring boot", "react", "node.js", "ci/cd",
    "github actions", "terraform", "networking", "tcp/ip", "dns", "dhcp", "vpn",
    "sla", "incident management", "itil", "agile", "scrum", "debugging",
)


def redact_pii(raw_text: str) -> str:
    """
    Strips Personal Identifiable Information (emails, phone numbers, street addresses,
    SIN/SSN, and profile URLs) in memory before any ATS analysis. Never stores PII.
    """
    text = raw_text or ""
    text = re.sub(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", "[REDACTED_EMAIL]", text)
    text = re.sub(
        r"(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b",
        "[REDACTED_PHONE]",
        text,
    )
    text = re.sub(r"https?://(?:www\.)?linkedin\.com/in/\S+", "[REDACTED_LINKEDIN]", text, flags=re.I)
    text = re.sub(r"\b[A-CEGHJ-NPR-TVXY]\d[A-CEGHJ-NPR-TV-Z]\s?\d[A-CEGHJ-NPR-TV-Z]\d\b", "[REDACTED_POSTAL]", text, flags=re.I)
    text = re.sub(r"\b\d{3}[-\s]\d{3}[-\s]\d{3}\b", "[REDACTED_ID]", text)
    return text


def evaluate_ats_resume_match(
    resume_text: str,
    recent_jobs: list[dict[str, Any]],
    active_roles: list[str],
) -> str:
    """
    Performs a 100% grounded, Zero-PII ATS keyword & bullet analysis comparing
    the user's redacted resume text against live tracked job descriptions.
    """
    sanitized_resume = redact_pii(resume_text)
    resume_lower = sanitized_resume.lower()

    corpus = " ".join(
        f"{j.get('title', '')} {j.get('description', '')}" for j in recent_jobs
    ).lower()
    if not corpus.strip():
        corpus = " ".join(active_roles).lower() + " " + " ".join(ATS_TECH_SKILLS_VOCAB[:20])

    target_keywords = [kw for kw in ATS_TECH_SKILLS_VOCAB if kw in corpus]
    if len(target_keywords) < 8:
        target_keywords = list(ATS_TECH_SKILLS_VOCAB[:16])

    matched = [kw for kw in target_keywords if kw in resume_lower]
    missing = [kw for kw in target_keywords if kw not in resume_lower][:8]

    score = int(round((len(matched) / max(1, len(target_keywords))) * 100))
    matched_str = ", ".join(f"<code>{html.escape(k)}</code>" for k in matched[:10]) or "<i>None detected yet</i>"
    missing_str = ", ".join(f"<code>{html.escape(k)}</code>" for k in missing) or "<i>All core keywords covered!</i>"

    return (
        "🛡️ <b>Acorn AI — Grounded ATS & Resume Co-Pilot (Zero-PII)</b>\n"
        "<i>Personal identifiers (email, phone, postal code) were automatically redacted in memory and never stored.</i>\n\n"
        f"📊 <b>ATS Keyword Match Score:</b> <b>{score}%</b> ({len(matched)}/{len(target_keywords)} target skills matched)\n\n"
        f"✅ <b>Matched Keywords Found in Your Text:</b>\n{matched_str}\n\n"
        f"🎯 <b>High-Impact Keywords to Weave In (Only if True to Your Experience):</b>\n{missing_str}\n\n"
        "✍️ <b>Grounded ATS Optimization Tips (XYZ Formula):</b>\n"
        "• Start every bullet with a strong action verb (<i>Resolved, Engineered, Automated, Configured</i>).\n"
        "• Quantify ticket volume, SLA resolution rate, or latency improvements (e.g., "
        "<i>\"Resolved 30+ Tier-1/Tier-2 IT support tickets weekly via ServiceNow/Jira, maintaining 98% SLA compliance\"</i>).\n"
        "• Mirror exact phrasing from the job posting (e.g., spell out both <code>AWS</code> and <code>Amazon Web Services</code>).\n\n"
        "🗑️ <i>Send <code>/forget</code> anytime to wipe all cached job context immediately.</i>"
    )


# ---------------------------------------------------------------------------
# 5. Deduplication State Management (seen_jobs.json)
# ---------------------------------------------------------------------------

def load_seen_jobs(filepath: Path) -> dict[str, str]:
    """Load seen job IDs and content fingerprints mapped to UTC timestamps."""
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
    """Persist seen job IDs and fingerprints atomically to JSON."""
    atomic_write_json(filepath, seen)


# ---------------------------------------------------------------------------
# 6. Multi-Source Job Engines: LinkedIn, Indeed, Job Bank CA, Glassdoor, Google
# ---------------------------------------------------------------------------

def fetch_linkedin_job_details(numeric_job_id: str) -> dict[str, Any]:
    """
    Fetches LinkedIn's guest job detail page to extract:
      - `snippet`: 2–3 sentence mini description
      - `applicant_count`: numeric applicant count (e.g. 0–4 for First Mover, up to 40 cap)
      - `is_reposted`: True if the detail header says 'Reposted'
    """
    result: dict[str, Any] = {"snippet": "", "applicant_count": None, "is_reposted": False}
    if not numeric_job_id or not numeric_job_id.isdigit():
        return result

    detail_url = f"https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{numeric_job_id}"
    headers = {"User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9"}
    try:
        resp = requests.get(detail_url, headers=headers, timeout=10)
        if resp.status_code != 200:
            return result

        raw_html = resp.text
        soup = BeautifulSoup(raw_html, "html.parser")

        header_text = soup.get_text(" ", strip=True)
        if re.search(r"\breposted\b", header_text, re.I):
            result["is_reposted"] = True

        app_el = soup.find(class_=re.compile(r"num-applicants__caption"))
        app_text = app_el.get_text(" ", strip=True) if app_el else header_text
        app_text_lower = app_text.lower()

        if "less than 5" in app_text_lower or "fewer than 5" in app_text_lower:
            result["applicant_count"] = 2
        elif "be among the first 25" in app_text_lower:
            # LinkedIn shows 'Be among the first 25 applicants' on brand-new listings (typically 0-4 applicants)
            result["applicant_count"] = 3
        else:
            app_match = re.search(r"(\d+)\s+applicants?", app_text_lower)
            if app_match:
                result["applicant_count"] = int(app_match.group(1))

        desc_el = soup.find("div", class_=re.compile(r"show-more-less-html__markup|description__text"))
        if desc_el:
            result["snippet"] = clean_mini_description(desc_el.get_text(" ", strip=True))
    except Exception:
        pass
    return result


def fetch_linkedin_guest_jobs(
    role: str,
    location_cfg: dict[str, Any],
    active_roles: list[str],
    max_age_seconds: int = MAX_AGE_SECONDS,
) -> list[dict[str, Any]]:
    """
    Queries LinkedIn's public Guest Jobs endpoint (`sortBy=DD` exact timestamp descending),
    prioritizing <5 applicant First-Mover listings while allowing up to 40 applicants.
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

    headers = {"User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9"}

    try:
        resp = requests.get(url, headers=headers, timeout=15)
        if resp.status_code != 200 or not resp.text.strip():
            return jobs

        soup = BeautifulSoup(resp.text, "html.parser")
        cards = soup.find_all("li")

        for card in cards:
            card_text = card.get_text(" ", strip=True)
            if is_reposted_or_saturated(card_text):
                continue

            base_card = card.find("div", class_=re.compile(r"base-card"))
            title_el = card.find("h3", class_=re.compile(r"base-search-card__title"))
            company_el = card.find("h4", class_=re.compile(r"base-search-card__subtitle"))
            loc_el = card.find("span", class_=re.compile(r"job-search-card__location"))
            time_el = card.find("time")
            link_el = card.find("a", class_=re.compile(r"base-card__full-link"))

            if not title_el or not link_el:
                continue

            title = title_el.get_text(strip=True)
            if not is_relevant_title(title, active_roles):
                continue

            company = company_el.get_text(strip=True) if company_el else "Unknown Company"
            location_str = loc_el.get_text(strip=True) if loc_el else location_cfg["name"]
            raw_url = link_el.get("href", "").split("?")[0].strip()
            if not raw_url:
                continue

            posted_text = time_el.get_text(strip=True) if time_el else "Just posted"
            age_sec = parse_relative_age_seconds(posted_text)
            if age_sec is not None and age_sec > max_age_seconds:
                continue

            entity_urn = base_card.get("data-entity-urn", "") if base_card else ""
            urn_match = re.search(r"(\d+)$", entity_urn)
            numeric_id = urn_match.group(1) if urn_match else ""
            job_id = f"li_{numeric_id}" if numeric_id else f"li_{raw_url}"

            details = fetch_linkedin_job_details(numeric_id)
            if details["is_reposted"] or is_reposted_or_saturated(
                "", applicant_count=details["applicant_count"]
            ):
                logger.info(
                    "Skipped reposted/saturated LinkedIn job '%s' at '%s' (applicants=%s)",
                    title,
                    company,
                    details["applicant_count"],
                )
                continue

            snippet = details["snippet"] or (
                f"Newly posted {title} opening at {company} ({location_str}) matching {role}."
            )

            if not validate_canadian_and_remote_eligibility(
                title, location_str, snippet, location_cfg["is_remote"]
            ):
                continue

            tier, badge = classify_location_priority(
                location_str,
                location_cfg["is_remote"],
                location_cfg["default_tier"],
            )
            velocity_rank, applicant_badge = classify_applicant_velocity(
                details["applicant_count"],
                posted_text,
            )

            jobs.append(
                {
                    "id": job_id,
                    "fingerprint": compute_job_fingerprint(company, title, location_str),
                    "title": title,
                    "company": company,
                    "location": location_str,
                    "job_type": "Full-time / Part-time / Contract",
                    "posted_ago": posted_text,
                    "age_seconds": age_sec if age_sec is not None else 300,
                    "applicant_count": details["applicant_count"],
                    "velocity_rank": velocity_rank,
                    "applicant_badge": applicant_badge,
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
    active_roles: list[str],
) -> list[dict[str, Any]]:
    """Queries Government of Canada's official Job Bank (`jobbank.gc.ca`), sorted by newest date."""
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

    headers = {"User-Agent": USER_AGENT, "Accept-Language": "en-CA,en;q=0.9"}

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
            if not is_relevant_title(title, active_roles):
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
            posted_text = date_el.get_text(strip=True) if date_el else "Just posted"

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

            detail_snippet = fetch_jobbank_detail_snippet(full_url)
            if not detail_snippet:
                sal_note = f" Compensation: {salary_str}." if salary_str else ""
                detail_snippet = (
                    f"Official Job Bank Canada listing for {title} at {company} in {location_str}.{sal_note}"
                )

            if not validate_canadian_and_remote_eligibility(
                title, location_str, detail_snippet, location_cfg["is_remote"]
            ):
                continue

            tier, badge = classify_location_priority(
                location_str,
                location_cfg["is_remote"],
                location_cfg["default_tier"],
            )
            velocity_rank, applicant_badge = classify_applicant_velocity(None, "Just posted")

            jobs.append(
                {
                    "id": job_id,
                    "fingerprint": compute_job_fingerprint(company, title, location_str),
                    "title": title,
                    "company": company,
                    "location": location_str,
                    "job_type": "Full-time / Part-time / Contract",
                    "posted_ago": f"New on Job Bank ({posted_text})",
                    "age_seconds": 120,
                    "applicant_count": None,
                    "velocity_rank": velocity_rank,
                    "applicant_badge": applicant_badge,
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
    active_roles: list[str],
) -> list[dict[str, Any]]:
    """
    Uses `python-jobspy` to query Indeed Canada, LinkedIn, Glassdoor Canada,
    and Google Jobs with strict role-title alignment, anti-repost checks, and Canadian geofencing.
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
            if not is_relevant_title(title, active_roles):
                continue

            company = str(row.get("company") or "Unknown Company").strip()
            location_str = str(row.get("location") or location_cfg["indeed_location"]).strip()
            job_url = str(row.get("job_url") or "").strip()
            if not job_url or job_url == "nan":
                continue

            raw_desc = str(row.get("description") or "")
            if is_reposted_or_saturated(f"{title} {raw_desc}"):
                continue

            is_remote_flag = bool(row.get("is_remote")) or location_cfg["is_remote"]
            if not validate_canadian_and_remote_eligibility(
                title, location_str, raw_desc, is_remote_flag
            ):
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

            mini_desc = clean_mini_description(
                raw_desc,
                fallback=f"New {title} role at {company} in {location_str} ({raw_job_type}).",
            )

            tier, badge = classify_location_priority(
                location_str,
                is_remote_flag,
                location_cfg["default_tier"],
            )
            velocity_rank, applicant_badge = classify_applicant_velocity(None, "Just posted")

            jobs.append(
                {
                    "id": job_id,
                    "fingerprint": compute_job_fingerprint(company, title, location_str),
                    "title": title,
                    "company": company,
                    "location": location_str,
                    "job_type": raw_job_type,
                    "posted_ago": "Just posted (<1h)",
                    "age_seconds": 300,
                    "applicant_count": None,
                    "velocity_rank": velocity_rank,
                    "applicant_badge": applicant_badge,
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
# 7. Telegram Notification & Interactive Role + ATS Buttons
# ---------------------------------------------------------------------------

def build_interactive_keyboard(job_url: str | None = None, source_name: str = "Job Board") -> dict[str, Any]:
    """
    Builds the Telegram inline keyboard attached to alerts and control menus:
      - Row 1 (if job_url): [🚀 Apply on <Source>]
      - Row 2: [➕ Add Job Role]  [📋 Manage Roles]
      - Row 3: [📄 ATS Resume Check]  [🗑️ Wipe My Data]
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
    rows.append(
        [
            {"text": "📄 ATS Resume Check", "callback_data": "ats_prompt"},
            {"text": "🗑️ Wipe My Data", "callback_data": "wipe_data"},
        ]
    )
    return {"inline_keyboard": rows}


def format_telegram_message(job: dict[str, Any]) -> str:
    """Formats a single job listing into clean Telegram HTML with First-Mover applicant badge."""
    badge = html.escape(job["priority_badge"])
    applicant_badge = html.escape(
        job.get("applicant_badge") or "⚡ FIRST MOVER (<5 Applicants — Apply First!)"
    )
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
        f"<b>{badge}</b>\n"
        f"<b>{applicant_badge}</b>\n\n"
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
    """Sends a formatted job alert with Apply, Add Role, and ATS Check buttons."""
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
        "💡 <b>Commands & Privacy Controls:</b>\n"
        "• Tap <b>➕ Add Job Role</b> or send <code>/add QA Analyst</code>\n"
        "• Send <code>/ats [paste resume bullets]</code> for Zero-PII ATS scoring\n"
        "• Send <code>/forget</code> to wipe all cached context immediately"
    )

    inline_rows: list[list[dict[str, str]]] = [
        [
            {"text": "➕ Add Job Role", "callback_data": "add_role_prompt"},
            {"text": "📄 ATS Resume Check", "callback_data": "ats_prompt"},
        ]
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
    Polls Telegram `getUpdates` with strict sender verification (`chat.id == TELEGRAM_CHAT_ID`)
    to process role management buttons, `/ats` resume checks, and `/forget` data erasure.
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

                if cb_chat_id != str(chat_id):
                    logger.warning("Rejected unauthorized callback from chat_id=%s", cb_chat_id)
                    continue

                if cb_data == "add_role_prompt":
                    cfg["awaiting_role_input"] = True
                    cfg["awaiting_ats_input"] = False
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
                elif cb_data == "ats_prompt":
                    cfg["awaiting_ats_input"] = True
                    cfg["awaiting_role_input"] = False
                    answer_callback_query(bot_token, cb_id, "Paste your resume bullets (no personal info needed)!")
                    send_telegram_message(
                        bot_token=bot_token,
                        chat_id=chat_id,
                        text=(
                            "📄 <b>Zero-PII ATS Resume Check</b>\n\n"
                            "Reply with your resume bullet points or skills section "
                            "(no name, phone, or email needed—any personal identifiers are automatically "
                            "redacted in memory and never saved):"
                        ),
                        reply_markup={"force_reply": True, "selective": True},
                    )
                elif cb_data == "wipe_data":
                    cfg["recent_job_context"] = []
                    cfg["awaiting_role_input"] = False
                    cfg["awaiting_ats_input"] = False
                    answer_callback_query(bot_token, cb_id, "Session data wiped!")
                    send_telegram_message(
                        bot_token=bot_token,
                        chat_id=chat_id,
                        text=(
                            "🗑️ <b>Privacy Erasure Complete</b>\n"
                            "All cached job context and temporary inputs have been permanently deleted. "
                            "Zero personal information is stored."
                        ),
                        reply_markup=build_interactive_keyboard(),
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

            # 2) Handle Text Messages & Commands
            msg = upd.get("message")
            if not msg:
                continue

            msg_chat_id = str(msg.get("chat", {}).get("id", ""))
            if msg_chat_id != str(chat_id):
                logger.warning("Rejected unauthorized message from chat_id=%s", msg_chat_id)
                continue

            text = (msg.get("text") or "").strip()
            if not text:
                continue

            reply_to_text = (msg.get("reply_to_message", {}).get("text") or "")
            is_reply_to_add_prompt = "Add New Job Role" in reply_to_text
            is_reply_to_ats_prompt = "Zero-PII ATS Resume Check" in reply_to_text

            if text.lower().startswith("/forget") or text.lower().startswith("/wipe"):
                cfg["recent_job_context"] = []
                cfg["awaiting_role_input"] = False
                cfg["awaiting_ats_input"] = False
                send_telegram_message(
                    bot_token=bot_token,
                    chat_id=chat_id,
                    text=(
                        "🗑️ <b>Privacy Erasure Complete</b>\n"
                        "All cached job context and temporary inputs have been permanently wiped."
                    ),
                    reply_markup=build_interactive_keyboard(),
                )

            elif text.lower().startswith("/ats") or cfg.get("awaiting_ats_input") or is_reply_to_ats_prompt:
                raw_resume = re.sub(r"^/ats(@\S+)?\s*", "", text, flags=re.IGNORECASE).strip()
                cfg["awaiting_ats_input"] = False
                if not raw_resume:
                    cfg["awaiting_ats_input"] = True
                    send_telegram_message(
                        bot_token=bot_token,
                        chat_id=chat_id,
                        text="📄 Reply with your resume bullets or skills to run a Zero-PII ATS match check:",
                        reply_markup={"force_reply": True, "selective": True},
                    )
                else:
                    report_html = evaluate_ats_resume_match(
                        raw_resume,
                        cfg.get("recent_job_context", []),
                        cfg["roles"],
                    )
                    send_telegram_message(
                        bot_token=bot_token,
                        chat_id=chat_id,
                        text=report_html,
                        reply_markup=build_interactive_keyboard(),
                    )

            elif text.lower().startswith("/add"):
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
# 8. Main Orchestration Loop
# ---------------------------------------------------------------------------

def collect_fresh_jobs(roles: list[str], seen: dict[str, str]) -> list[dict[str, Any]]:
    """
    Polls LinkedIn, Indeed Canada, Job Bank Canada, Glassdoor Canada, and Google Jobs,
    deduplicating by BOTH job ID and canonical content fingerprint (`company|title|city`),
    and sorting by:
      1. Location Priority Tier (1 = Mississauga/Toronto, 2 = GTA, 3 = Remote Canada)
      2. First-Mover Applicant Velocity Rank (1 = <5 Applicants, 2 = 5–25, 3 = 26–40)
      3. Exact Posting Age in Seconds (Newest first)
    """
    discovered: dict[str, dict[str, Any]] = {}
    discovered_fingerprints: set[str] = set()

    for location_cfg in SEARCH_LOCATIONS:
        for role in roles:
            logger.info("Checking [%s] in [%s]...", role, location_cfg["indeed_location"])

            candidates = (
                fetch_linkedin_guest_jobs(role, location_cfg, roles)
                + fetch_jobbank_ca_jobs(role, location_cfg, roles)
                + fetch_jobspy_jobs(role, location_cfg, roles)
            )

            for job in candidates:
                jid = job["id"]
                fp = job["fingerprint"]
                if jid in seen or fp in seen:
                    continue
                if jid in discovered or fp in discovered_fingerprints:
                    continue
                discovered[jid] = job
                discovered_fingerprints.add(fp)

            time.sleep(0.6)

    return sorted(
        discovered.values(),
        key=lambda x: (
            x.get("priority_tier", 3),
            x.get("velocity_rank", 2),
            x.get("age_seconds", 300),
        ),
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Acorn AI — First-Mover Canadian Job Tracker & Zero-PII ATS Co-Pilot"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate configuration and print sample alert without sending to Telegram.",
    )
    parser.add_argument(
        "--test-telegram",
        action="store_true",
        help="Send a sample test notification with interactive role & ATS buttons to Telegram.",
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
        help="Run in continuous high-frequency mode (polls Telegram every 3s and scans jobs every 60s).",
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
            "fingerprint": compute_job_fingerprint(
                "Example Tech Corp", "Junior Software Engineer (Java / AWS)", "Mississauga, ON"
            ),
            "title": "Junior Software Engineer (Java / AWS)",
            "company": "Example Tech Corp",
            "location": "Mississauga, ON",
            "job_type": "Full-time",
            "posted_ago": "2 minutes ago",
            "age_seconds": 120,
            "applicant_count": 2,
            "velocity_rank": 1,
            "applicant_badge": "⚡ FIRST MOVER (2 Applicants — Apply First!)",
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

    if process_telegram_updates(bot_token, chat_id, roles_cfg):
        save_roles_config(roles_cfg, ROLES_CONFIG_FILE)

    if args.test_telegram:
        sample_job = {
            "id": "test_notification",
            "fingerprint": "fp_test",
            "title": "✅ Acorn AI First-Mover Job Tracker & Zero-PII ATS Co-Pilot Active!",
            "company": "LinkedIn • Indeed CA • Job Bank CA • Glassdoor • Google Jobs",
            "location": "Mississauga / Toronto -> GTA -> Remote Canada",
            "job_type": "Full-time / Part-time / Contract / Intern",
            "posted_ago": "Just now",
            "age_seconds": 5,
            "applicant_count": 1,
            "velocity_rank": 1,
            "applicant_badge": "⚡ FIRST MOVER (<5 Applicants — Apply First!)",
            "description": (
                "Prioritizes brand-new postings with <5 applicants so you can apply first, while still showing "
                "open roles from 5 up to 40 applicants and blocking stale reposts (>40 applicants)."
            ),
            "url": "https://www.jobbank.gc.ca/jobsearch/jobsearch",
            "source": "Job Bank CA",
            "matched_role": f"{len(roles_cfg['roles'])} Active Roles",
            "priority_tier": 1,
            "priority_badge": "🔥 Priority 1 — Mississauga / Toronto",
        }
        ok = send_telegram_alert(bot_token, chat_id, sample_job)
        if ok:
            logger.info("Test Telegram alert with interactive role & ATS buttons sent!")
        else:
            raise SystemExit("Failed to send test Telegram alert.")
        return

    if args.listen:
        logger.info(
            "Starting continuous First-Mover mode (Telegram button listener every 3s + job scan every %ds)...",
            LISTEN_SCAN_INTERVAL_SECONDS,
        )
        last_scan = 0.0
        while True:
            if process_telegram_updates(bot_token, chat_id, roles_cfg):
                save_roles_config(roles_cfg, ROLES_CONFIG_FILE)
            now = time.time()
            if now - last_scan >= LISTEN_SCAN_INTERVAL_SECONDS:
                seen = load_seen_jobs(SEEN_JOBS_FILE)
                fresh_jobs = collect_fresh_jobs(roles_cfg["roles"], seen)
                now_iso = datetime.now(timezone.utc).isoformat()
                for job in fresh_jobs:
                    if send_telegram_alert(bot_token, chat_id, job):
                        seen[job["id"]] = now_iso
                        seen[job["fingerprint"]] = now_iso
                        roles_cfg["recent_job_context"] = (
                            [{"title": job["title"], "description": job["description"]}]
                            + roles_cfg.get("recent_job_context", [])
                        )[:5]
                        time.sleep(0.5)
                save_seen_jobs(SEEN_JOBS_FILE, seen)
                save_roles_config(roles_cfg, ROLES_CONFIG_FILE)
                last_scan = time.time()
            time.sleep(3.0)

    seen = load_seen_jobs(SEEN_JOBS_FILE)
    logger.info(
        "Loaded %d seen keys and %d active roles.",
        len(seen),
        len(roles_cfg["roles"]),
    )

    fresh_jobs = collect_fresh_jobs(roles_cfg["roles"], seen)
    logger.info("Found %d new verified jobs.", len(fresh_jobs))

    now_iso = datetime.now(timezone.utc).isoformat()
    sent_count = 0

    for job in fresh_jobs:
        if send_telegram_alert(bot_token, chat_id, job):
            seen[job["id"]] = now_iso
            seen[job["fingerprint"]] = now_iso
            roles_cfg["recent_job_context"] = (
                [{"title": job["title"], "description": job["description"]}]
                + roles_cfg.get("recent_job_context", [])
            )[:5]
            sent_count += 1
            time.sleep(0.5)

    save_seen_jobs(SEEN_JOBS_FILE, seen)
    save_roles_config(roles_cfg, ROLES_CONFIG_FILE)
    logger.info("Sent %d alerts and saved state.", sent_count)


if __name__ == "__main__":
    main()
