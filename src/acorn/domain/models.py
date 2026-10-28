"""
Acorn Domain Models & Value Objects
===================================
Encapsulates enterprise business entities, value objects, first-mover velocity tiers,
dual-key deduplication hashing, and ATS resume co-pilot data structures.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from enum import IntEnum
import hashlib
import re
from typing import Any


class PriorityTier(IntEnum):
    """Geographic proximity priority tier."""
    CORE_GTA = 1       # Mississauga, Toronto core
    OUTER_GTA = 2      # Peel, Halton, York, Durham, Hamilton
    REMOTE_CANADA = 3  # Canada-wide Telework / Remote


class VelocityRank(IntEnum):
    """Applicant velocity and first-mover urgency ranking."""
    TIER_A_FIRST_MOVER = 1   # <5 Applicants OR Just Posted <10m (⚡ FIRST MOVER)
    TIER_B_EARLY_WINDOW = 2  # 5 to 25 Applicants (🟢 Early Window)
    TIER_C_ACTIVE_WINDOW = 3 # 26 to 40 Applicants (🟡 Active Window)
    SATURATED_OR_DROPPED = 4 # >40 Applicants OR Reposted (Dropped)


@dataclass(frozen=True)
class LocationSpec:
    """Geographic search specification."""
    name: str
    indeed_location: str
    jobbank_location: str
    is_remote: bool
    default_tier: int = 2


@dataclass
class JobListing:
    """Represents a discovered employment opening."""
    id: str
    title: str
    company: str
    location: str
    job_type: str
    posted_ago: str
    description: str
    url: str
    source: str
    matched_role: str
    priority_tier: int
    priority_badge: str
    applicant_count: int | None = None
    velocity_rank: int = int(VelocityRank.TIER_B_EARLY_WINDOW)
    velocity_badge: str = "🟢 Early Window"
    is_reposted: bool = False
    age_seconds: int = 1800
    fingerprint: str = ""
    discovered_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    def __post_init__(self) -> None:
        if not self.fingerprint:
            self.fingerprint = self.compute_fingerprint(self.company, self.title, self.location)

    @staticmethod
    def compute_fingerprint(company: str, title: str, location: str) -> str:
        """
        Computes a deterministic canonical fingerprint for cross-board deduplication:
        fp_<sha256(norm_company | norm_title | norm_city)[:16]>
        """
        def norm(s: str) -> str:
            clean = re.sub(r"[^a-zA-Z0-9]", "", (s or "").lower())
            return clean.strip()

        raw = f"{norm(company)}|{norm(title)}|{norm(location)}"
        digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]
        return f"fp_{digest}"

    def to_dict(self) -> dict[str, Any]:
        """Serializes the job listing to a dictionary."""
        return asdict(self)


@dataclass
class ATSMatchResult:
    """Evaluation result from zero-PII grounded ATS analysis."""
    match_score: int
    matched_keywords: list[str]
    missing_keywords: list[str]
    xyz_bullet_recommendations: list[str]
    summary_analysis: str


@dataclass
class AppConfig:
    """Centralized runtime application configuration."""
    max_age_seconds: int = 3600
    cron_enabled: bool = True
    max_applicants_threshold: int = 40
    first_mover_applicant_threshold: int = 5
    priority_1_locations: list[str] = field(default_factory=lambda: [
        "mississauga", "toronto", "etobicoke", "north york",
        "scarborough", "east york", "york"
    ])
    priority_2_locations: list[str] = field(default_factory=lambda: [
        "brampton", "oakville", "burlington", "milton", "vaughan",
        "woodbridge", "markham", "richmond hill", "thornhill", "pickering",
        "ajax", "whitby", "oshawa", "newmarket", "aurora", "caledon",
        "halton", "peel", "durham", "hamilton", "greater toronto", "gta"
    ])
    excluded_senior_keywords: list[str] = field(default_factory=lambda: [
        "senior", "sr.", "sr ", "staff", "principal", "director",
        "vp ", "vice president", "head of", "architect", "manager", "lead"
    ])
    junior_override_keywords: list[str] = field(default_factory=lambda: [
        "junior", "jr", "intern", "internship", "co-op", "coop",
        "entry", "associate", "graduate", "level 1", "tier 1", "l1"
    ])
    search_locations: list[LocationSpec] = field(default_factory=lambda: [
        LocationSpec(
            name="Mississauga, Ontario, Canada",
            indeed_location="Mississauga, ON",
            jobbank_location="Mississauga (ON)",
            is_remote=False,
            default_tier=1,
        ),
        LocationSpec(
            name="Toronto, Ontario, Canada",
            indeed_location="Toronto, ON",
            jobbank_location="Toronto (ON)",
            is_remote=False,
            default_tier=1,
        ),
        LocationSpec(
            name="Greater Toronto Area, Canada",
            indeed_location="Greater Toronto Area, ON",
            jobbank_location="Toronto (ON)",
            is_remote=False,
            default_tier=2,
        ),
        LocationSpec(
            name="Canada",
            indeed_location="Remote",
            jobbank_location="Canada",
            is_remote=True,
            default_tier=3,
        ),
    ])
