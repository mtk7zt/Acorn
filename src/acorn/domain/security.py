"""
Zero-PII Grounded ATS & Security Subsystem
==========================================
Provides memory-only PII redaction and deterministic, live-grounded
ATS resume matching with Google XYZ-formula bullet suggestions.
"""

from __future__ import annotations

import re
from typing import Set

from src.acorn.domain.models import ATSMatchResult

# Regular expressions for PII detection
EMAIL_REGEX = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b")
PHONE_REGEX = re.compile(r"(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b")
POSTAL_CODE_REGEX = re.compile(r"\b[A-CEGHJ-NPRSTVXYa-ceghj-nprstvxy]\d[A-Za-z][ -]?\d[A-Za-z]\d\b")
SIN_SSN_REGEX = re.compile(r"\b\d{3}[-\s]?\d{3}[-\s]?\d{3}\b")
LINKEDIN_URL_REGEX = re.compile(r"https?://(?:www\.)?linkedin\.com/(?:in|profile)/[A-Za-z0-9_\-\./]+")

# Canonical tech & domain keywords commonly found in software/IT job postings
CANONICAL_TECH_KEYWORDS = {
    "python", "java", "javascript", "typescript", "c++", "c#", ".net", "golang", "go",
    "rust", "sql", "postgresql", "mysql", "mongodb", "redis", "dynamodb",
    "aws", "azure", "gcp", "google cloud", "cloud", "docker", "kubernetes", "k8s",
    "ci/cd", "github actions", "gitlab", "terraform", "ansible", "linux", "bash",
    "rest", "restful", "api", "graphql", "microservices", "kafka", "rabbit",
    "git", "jira", "agile", "scrum", "unit test", "integration test", "pytest", "junit",
    "react", "angular", "vue", "next.js", "node.js", "express", "django", "flask",
    "spring", "spring boot", "active directory", "windows server", "office 365", "o365",
    "help desk", "it support", "troubleshooting", "network", "dns", "dhcp", "tcp/ip",
    "powershell", "customer support", "ticketing", "servicenow", "zendesk", "tier 1",
    "hardware", "software", "analyst", "security", "sla", "itsm"
}


def redact_pii(text: str) -> str:
    """
    Strips email addresses, phone numbers, Canadian postal codes, SINs,
    and LinkedIn URLs in-memory before any processing.
    """
    if not text:
        return ""

    sanitized = EMAIL_REGEX.sub("[REDACTED_EMAIL]", text)
    sanitized = PHONE_REGEX.sub("[REDACTED_PHONE]", sanitized)
    sanitized = POSTAL_CODE_REGEX.sub("[REDACTED_POSTAL_CODE]", sanitized)
    sanitized = SIN_SSN_REGEX.sub("[REDACTED_IDENTIFIER]", sanitized)
    sanitized = LINKEDIN_URL_REGEX.sub("[REDACTED_LINKEDIN_URL]", sanitized)

    return sanitized


def extract_keywords_from_text(text: str) -> Set[str]:
    """Extracts known tech and industry keywords from text."""
    lower_text = (text or "").lower()
    found: Set[str] = set()

    for kw in CANONICAL_TECH_KEYWORDS:
        # Match word boundaries or exact phrases
        pattern = r"\b" + re.escape(kw) + r"\b"
        if re.search(pattern, lower_text):
            found.add(kw)

    return found


def evaluate_ats_resume_match(
    resume_text: str,
    job_description: str,
    job_title: str,
) -> ATSMatchResult:
    """
    Performs zero-PII ATS evaluation comparing a resume against a target job.
    Computes a deterministic keyword match percentage and XYZ-formula suggestions:
    'Accomplished [X] as measured by [Y], by doing [Z]'.
    """
    # 1. Strip all PII from resume in-memory
    clean_resume = redact_pii(resume_text)
    clean_jd = (job_description or "") + " " + (job_title or "")

    # 2. Extract technical tokens
    resume_keywords = extract_keywords_from_text(clean_resume)
    jd_keywords = extract_keywords_from_text(clean_jd)

    if not jd_keywords:
        # Fallback if no canonical tech keywords found in description
        jd_keywords = {"troubleshooting", "communication", "technical support", "documentation"}

    matched = sorted(list(resume_keywords.intersection(jd_keywords)))
    missing = sorted(list(jd_keywords.difference(resume_keywords)))

    # 3. Calculate deterministic match score
    match_score = int(round((len(matched) / len(jd_keywords)) * 100))
    match_score = max(0, min(100, match_score))

    # 4. Generate grounded XYZ-formula bullet points for top missing keywords
    xyz_bullets: list[str] = []
    top_missing = missing[:3]

    for kw in top_missing:
        kw_title = kw.title()
        if kw in ("aws", "gcp", "azure", "cloud", "docker", "kubernetes"):
            xyz_bullets.append(
                f"• Accomplished 99.9% application uptime as measured by Prometheus monitoring, by deploying {kw_title} cloud microservices and automated health-check pipelines."
            )
        elif kw in ("python", "java", "sql", "api", "rest"):
            xyz_bullets.append(
                f"• Accelerated query execution latency by 35% as measured by APM logs, by developing optimized {kw_title} backend endpoints and indexing database structures."
            )
        elif kw in ("help desk", "it support", "troubleshooting", "active directory", "servicenow"):
            xyz_bullets.append(
                f"• Resolved 45+ daily technical tickets maintaining a 98% first-contact SLA, by standardizing {kw_title} triage runbooks and remote diagnostic workflows."
            )
        else:
            xyz_bullets.append(
                f"• Enhanced workflow efficiency by 20% across team deliverables, by integrating {kw_title} into core operational processes and documentation."
            )

    summary = (
        f"Evaluated against {len(jd_keywords)} core technical competencies found in the {job_title} opening. "
        f"Resume demonstrated alignment on {len(matched)} keys with {len(missing)} optimization opportunities."
    )

    return ATSMatchResult(
        match_score=match_score,
        matched_keywords=matched,
        missing_keywords=missing,
        xyz_bullet_recommendations=xyz_bullets,
        summary_analysis=summary,
    )
