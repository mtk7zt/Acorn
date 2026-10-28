"""
Unit Tests: Zero-PII Redaction & Grounded ATS Match Engine
"""

import pytest
from src.acorn.domain.security import redact_pii, evaluate_ats_resume_match


def test_pii_redaction():
    sample_text = (
        "John Doe, email: john.doe@example.com, phone: +1 (416) 555-0199, "
        "Postal Code: M5V 2T6, SIN: 123-456-789, LinkedIn: https://www.linkedin.com/in/johndoe"
    )
    redacted = redact_pii(sample_text)

    assert "john.doe@example.com" not in redacted
    assert "[REDACTED_EMAIL]" in redacted

    assert "416" not in redacted or "[REDACTED_PHONE]" in redacted
    assert "[REDACTED_POSTAL_CODE]" in redacted
    assert "[REDACTED_IDENTIFIER]" in redacted
    assert "[REDACTED_LINKEDIN_URL]" in redacted


def test_ats_resume_match_evaluation():
    resume = (
        "Experienced with Python, SQL, REST APIs, Git, and Docker. "
        "Assisted clients with troubleshooting."
    )
    job_desc = (
        "Looking for a Junior Software Engineer with Python, Docker, AWS, "
        "Kubernetes, and CI/CD pipelines to build REST APIs."
    )

    result = evaluate_ats_resume_match(
        resume_text=resume,
        job_description=job_desc,
        job_title="Junior Software Engineer",
    )

    assert result.match_score > 0
    assert "python" in result.matched_keywords
    assert "docker" in result.matched_keywords
    assert "aws" in result.missing_keywords
    assert len(result.xyz_bullet_recommendations) > 0
    # Check Google XYZ formula pattern
    assert any("Accomplished" in bullet for bullet in result.xyz_bullet_recommendations)
