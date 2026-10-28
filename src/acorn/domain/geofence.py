"""
Strict Canadian Jurisdiction & True-Remote Geofencing
=====================================================
Enforces geographical boundary rules to suppress foreign locations,
US two-letter state suffixes, and false-positive non-GTA on-site roles.
"""

from __future__ import annotations

import re

# Foreign countries and territories explicitly blocked
FOREIGN_COUNTRIES = {
    "united states", "usa", "u.s.", "u.s.a.", "india", "united kingdom", "uk",
    "germany", "poland", "france", "australia", "netherlands", "brazil", "mexico",
    "philippines", "singapore", "ireland", "spain", "italy", "switzerland", "china"
}

# US State abbreviations (including ', CA' when Canada is absent)
US_STATE_SUFFIX_PATTERN = re.compile(
    r",\s*(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b",
    re.IGNORECASE
)

# Core Canadian jurisdiction keywords
CANADIAN_JURISDICTION_MARKERS = {
    "canada", "ontario", ", on", " ontario", "mississauga", "toronto", "brampton",
    "oakville", "burlington", "milton", "vaughan", "woodbridge", "markham", "richmond hill",
    "thornhill", "pickering", "ajax", "whitby", "oshawa", "newmarket", "aurora",
    "caledon", "halton", "peel", "durham", "hamilton", "gta", "greater toronto"
}

# Explicit remote confirmation tokens
REMOTE_CONFIRMATION_TOKENS = {
    "remote", "telework", "work from home", "wfh", "anywhere in canada", "virtual"
}

# Priority 1 (Core GTA)
PRIORITY_1_CITIES = {
    "mississauga", "toronto", "etobicoke", "north york", "scarborough", "east york", "york"
}

# Priority 2 (Outer GTA)
PRIORITY_2_CITIES = {
    "brampton", "oakville", "burlington", "milton", "vaughan", "woodbridge",
    "markham", "richmond hill", "thornhill", "pickering", "ajax", "whitby",
    "oshawa", "newmarket", "aurora", "caledon", "halton", "peel", "durham",
    "hamilton", "greater toronto", "gta"
}


def validate_canadian_and_remote_eligibility(
    location_text: str,
    is_remote_query: bool = False,
    default_tier: int = 2,
) -> tuple[bool, int, str]:
    """
    Validates location against strict Canadian geofence rules.
    Returns:
        (is_valid: bool, priority_tier: int, badge: str)
    """
    raw_loc = (location_text or "").strip()
    loc_lower = raw_loc.lower()

    if not loc_lower:
        return False, 0, ""

    # 1. Block explicit foreign countries
    for foreign in FOREIGN_COUNTRIES:
        # Check boundary match
        pattern = r"\b" + re.escape(foreign) + r"\b"
        if re.search(pattern, loc_lower):
            return False, 0, ""

    # 2. Block US State Suffixes (e.g. "San Francisco, CA" or "Austin, TX")
    # Exception: if ", CA" is present BUT "Canada" or "Ontario" or "ON" is also in the text, evaluate carefully
    if US_STATE_SUFFIX_PATTERN.search(raw_loc):
        # If it matched ", CA" check if it meant Canada or California
        if re.search(r",\s*CA\b", raw_loc, re.IGNORECASE):
            if "canada" not in loc_lower and "ontario" not in loc_lower and ", on" not in loc_lower:
                return False, 0, ""
        else:
            return False, 0, ""

    # 3. Check for explicit Canadian jurisdiction
    has_canadian_marker = any(marker in loc_lower for marker in CANADIAN_JURISDICTION_MARKERS)
    if not has_canadian_marker:
        return False, 0, ""

    # 4. Priority 1 (Core GTA) Classification
    if any(city in loc_lower for city in PRIORITY_1_CITIES):
        return True, 1, "🔥 Priority 1 — Mississauga / Toronto"

    # 5. Priority 2 (Outer GTA) Classification
    if any(city in loc_lower for city in PRIORITY_2_CITIES):
        return True, 2, "📍 Priority 2 — Surrounding GTA"

    # 6. Priority 3 (Remote) Classification
    has_remote_confirmation = any(t in loc_lower for t in REMOTE_CONFIRMATION_TOKENS)

    if has_remote_confirmation:
        return True, 3, "🌐 Priority 3 — Remote (Canada)"

    # If this query was specifically looking for remote jobs, but the job text does not confirm remote:
    if is_remote_query or default_tier == 3:
        # If no explicit remote confirmation in text, suppress non-GTA on-site roles
        return False, 0, ""

    # Default fallback to Priority 2 if in Canada/Ontario
    if "ontario" in loc_lower or ", on" in loc_lower or "canada" in loc_lower:
        return True, 2, "📍 Priority 2 — Surrounding GTA"

    return False, 0, ""
