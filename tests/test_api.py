"""
Unit Tests: Acorn Core FastAPI REST API
=======================================
Validates /v1/health, /v1/signals, /v1/briefings, /v1/fit/evaluate,
/v1/activity, /v1/users, and /v1/privacy/data endpoints.
"""

from pathlib import Path
import tempfile
import pytest
from starlette.testclient import TestClient

from src.acorn.domain.models import JobListing
from src.acorn.infrastructure.persistence.sqlite_repo import SqliteAcornRepository
from src.acorn.interfaces.api.api import create_app


@pytest.fixture
def api_client():
    with tempfile.TemporaryDirectory() as tmp_dir:
        db_file = Path(tmp_dir) / "test_api.db"
        test_repo = SqliteAcornRepository(db_path=db_file)
        app = create_app(repo=test_repo)
        client = TestClient(app)
        yield client, test_repo


def test_api_health_endpoint(api_client):
    client, _ = api_client
    resp = client.get("/v1/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert data["version"] == "2.0.0"


def test_api_user_preferences_update(api_client):
    client, _ = api_client
    payload = {
        "display_name": "Alex Candidate",
        "target_roles": ["Junior Python Developer", "Cloud Support Associate"],
        "telegram_chat_id": "555123456",
    }
    resp = client.post("/v1/users", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "updated"
    assert "Junior Python Developer" in data["target_roles"]
    assert data["telegram_chat_id"] == "555123456"


def test_api_ats_evaluate_endpoint(api_client):
    client, _ = api_client
    payload = {
        "resume_text": "Experienced in Python, Docker, SQL, and Linux. Built REST APIs.",
        "job_description": "We are seeking a Junior Cloud Developer with Python, AWS, Docker, and Kubernetes.",
        "job_title": "Junior Cloud Developer",
    }
    resp = client.post("/v1/fit/evaluate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["match_score"] > 0
    assert "python" in data["matched_keywords"]
    assert "aws" in data["missing_keywords"]
    assert len(data["xyz_bullet_recommendations"]) > 0
    # Check that high-impact bullet points are generated
    assert any("Accomplished" in b for b in data["xyz_bullet_recommendations"])
    assert any("99.9% application uptime" in b for b in data["xyz_bullet_recommendations"])


def test_api_jd_analyze_endpoint(api_client):
    client, _ = api_client
    payload = {
        "jd_text": "Looking for a Software Developer with Python, AWS, Docker, PostgreSQL, and CI/CD pipelines.",
        "job_title": "Backend Software Developer",
    }
    resp = client.post("/v1/jd/analyze", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_keywords_found"] >= 4
    assert "python" in data["extracted_keywords"]
    assert "aws" in data["extracted_keywords"]
    assert len(data["ats_passing_statements"]) > 0
    # Verify business value & numerical metrics in statements
    assert any("99.9% application uptime" in stmt for stmt in data["ats_passing_statements"])


def test_api_resume_evaluate_with_actionable_edits(api_client):
    client, _ = api_client
    payload = {
        "resume_text": "Hands-on experience in Python, SQL, Git, and troubleshooting.",
        "jd_text": "Must have Python, AWS, Docker, Kubernetes, and CI/CD.",
        "job_title": "Cloud Platform Engineer",
    }
    resp = client.post("/v1/resume/evaluate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert 0 <= data["ats_score"] <= 100
    assert "python" in data["matched_skills"]
    assert "aws" in data["missing_skills"]
    assert len(data["actionable_edits"]) > 0
    assert len(data["recommended_impact_bullets"]) > 0
    # Statement demonstrates measurable business value
    assert any("Accomplished" in b for b in data["recommended_impact_bullets"])



def test_api_on_demand_scan_and_briefings(api_client):
    client, test_repo = api_client

    # Seed an opportunity in the repository
    job = JobListing(
        id="api_job_001",
        title="Junior Software Engineer",
        company="Shopify Canada",
        location="Toronto, ON",
        job_type="Full-time",
        posted_ago="5m ago",
        description="Python, PostgreSQL",
        url="https://shopify.com/jobs/api_001",
        source="LinkedIn",
        matched_role="Junior Software Engineer",
        priority_tier=1,
        priority_badge="Priority 1",
        applicant_count=2,
    )
    test_repo.save_opportunity(job)

    # Trigger scan
    scan_resp = client.post("/v1/briefings/scan")
    assert scan_resp.status_code == 200
    scan_data = scan_resp.json()
    assert scan_data["scanned_opportunities"] >= 1
    assert scan_data["new_signals_found"] >= 1

    # Fetch signals
    sig_resp = client.get("/v1/signals")
    assert sig_resp.status_code == 200
    signals = sig_resp.json()
    assert len(signals) >= 1
    sig_id = signals[0]["id"]

    # Take action on signal (mark applied)
    act_resp = client.post(f"/v1/signals/{sig_id}/action", json={"action": "applied"})
    assert act_resp.status_code == 200
    assert act_resp.json()["new_status"] == "applied"

    # Fetch activity log
    act_log = client.get("/v1/activity")
    assert act_log.status_code == 200
    assert len(act_log.json()) >= 1


def test_api_privacy_purge(api_client):
    client, _ = api_client
    resp = client.delete("/v1/privacy/data")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "purged"
    assert "purged from memory" in data["memory_status"]
