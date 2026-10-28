"""
Strict Role-Title Token Alignment & Filtration Subsystem
========================================================
Enforces canonical domain token matching, senior exclusions with junior overrides,
and automatic suppression of non-technical false-positive titles.
"""

from __future__ import annotations

import re

CORE_ROLE_DOMAIN_TOKENS = {
    "software", "developer", "engineer", "it", "support", "helpdesk",
    "help desk", "analyst", "cloud", "aws", "azure", "java", "python",
    "full stack", "fullstack", "backend", "frontend", "web", "devops",
    "qa", "quality assurance", "test", "tester", "systems", "network",
    "technician", "programmer", "data", "database", "cyber", "security",
    "administrator", "application", "app", "tech", "technical"
}

NON_TECH_FALSE_POSITIVES = {
    "sales representative", "account executive", "warehouse", "driver",
    "forklift", "cashier", "receptionist", "store associate", "cook", "chef",
    "nurse", "construction", "cleaner", "housekeeper", "barista", "server",
    "waiter", "security guard", "truck driver", "delivery", "retail associate",
    "merchandiser", "general labour", "general labor", "packaging", "picker"
}

EXCLUDED_SENIOR_KEYWORDS = {
    "senior", "sr.", "sr ", "staff", "principal", "director", "vp ",
    "vice president", "head of", "architect", "manager", "lead"
}

JUNIOR_OVERRIDE_KEYWORDS = {
    "junior", "jr", "intern", "internship", "co-op", "coop", "entry",
    "associate", "graduate", "level 1", "tier 1", "l1"
}


def is_relevant_title(
    job_title: str,
    user_roles: list[str] | None = None,
) -> bool:
    """
    Validates whether job title meets domain relevance requirements:
    1. Blocks non-technical occupational false positives.
    2. Enforces Senior/Manager exclusion unless a junior keyword overrides it.
    3. Requires at least one canonical tech token OR exact token alignment with a user-added role.
    """
    title_lower = (job_title or "").lower().strip()
    if not title_lower:
        return False

    # 1. Block non-tech false positives
    for non_tech in NON_TECH_FALSE_POSITIVES:
        pattern = r"\b" + re.escape(non_tech) + r"\b"
        if re.search(pattern, title_lower):
            return False

    # 2. Block un-overridden Senior/Lead titles
    has_junior_override = any(k in title_lower for k in JUNIOR_OVERRIDE_KEYWORDS)
    if not has_junior_override:
        for senior_kw in EXCLUDED_SENIOR_KEYWORDS:
            pattern = r"\b" + re.escape(senior_kw) + r"\b" if "." not in senior_kw and " " not in senior_kw else re.escape(senior_kw)
            if re.search(pattern, title_lower):
                return False

    # 3. Check for core technical token alignment
    has_core_domain_token = any(token in title_lower for token in CORE_ROLE_DOMAIN_TOKENS)
    if has_core_domain_token:
        return True

    # 4. Check if title aligns with all tokens of any custom user-added role
    if user_roles:
        for custom_role in user_roles:
            role_tokens = [t.lower().strip() for t in custom_role.split() if len(t.strip()) > 1]
            if role_tokens and all(token in title_lower for token in role_tokens):
                return True

    return False
