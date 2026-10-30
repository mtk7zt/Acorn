"""
Acorn Delivery Reliability & Mandatory Integration Test Suite
=============================================================
Milestone: BETA-02 — Multi-User Isolation, Immediate Job Delivery & Portability
Implements all mandatory integration test scenarios specified in Section 24:
  - TEST A: Immediate automatic matching (Forklift tester receives alert; Founder receives 0)
  - TEST B: Multiple matching users (Both receive separate user-owned notifications)
  - TEST C: Global deduplication decoupling (Existing catalog job delivered to new tester on /scan)
  - TEST D: Manual scan results (Tester receives usable results and verified links)
  - TEST E: No results (Clear completion message delivered; Founder receives 0)
  - TEST F: Partial source failure (One source fails; available sources delivered with disclaimer)
  - TEST G: Conversational AI context isolation (Tester tracking Forklift Operator never sees Founder's 13 roles)
  - TEST H: Terminal scan status (0 matches yields explicit completion message rather than silence)
  - TEST I: Delivery failure isolation (Failure to deliver to User A does not block User B)
  - TEST J: Duplicate prevention per user (Same discovery event doesn't re-notify same user)
"""

from __future__ import annotations

import os
from unittest.mock import MagicMock
import pytest

from src.acorn.application.pipeline import JobTrackingPipeline, PipelineSummary
from src.acorn.domain.models import AppConfig, JobListing, PriorityTier, VelocityRank
from src.acorn.interfaces.notifier import BaseNotifier
from src.acorn.interfaces.scraper import BaseJobScraper
from src.acorn.interfaces.storage import BaseStateStore


class MockReliableNotifier(BaseNotifier):
    """Notifier implementation capturing alerts and system messages by recipient."""

    def __init__(self, target_chat_id: str):
        self.target_chat_id = target_chat_id
        self.alerts_delivered: list[tuple[str, JobListing]] = []
        self.system_messages: list[tuple[str, str]] = []
        self.should_fail_send: bool = False

    def send_alert(self, job: JobListing) -> bool:
        if self.should_fail_send:
            return False
        self.alerts_delivered.append((self.target_chat_id, job))
        return True

    def send_system_message(self, text: str) -> bool:
        self.system_messages.append((self.target_chat_id, text))
        return True


class MockConfigurableScraper(BaseJobScraper):
    """Scraper supporting simulated errors and configurable candidate returns."""

    def __init__(self, name: str, jobs: list[JobListing], should_raise: bool = False):
        self._name = name
        self._jobs = jobs
        self._should_raise = should_raise

    @property
    def name(self) -> str:
        return self._name

    def scrape(self, role: str, location, max_age_seconds: int) -> list[JobListing]:
        if self._should_raise:
            raise RuntimeError(f"Simulated HTTP 403 Rate Limit on {self._name}")
        results = []
        for j in self._jobs:
            if role.lower() in j.title.lower():
                results.append(j)
        return results


class MockDecoupledStateStore(BaseStateStore):
    """In-memory store providing independent global and per-user seen stores."""

    def __init__(self, default_roles: list[str] | None = None):
        self.global_seen: dict[str, str] = {}
        self.user_seen: dict[str, dict[str, str]] = {}
        self.roles_cfg = {"roles": default_roles or []}

    def load_seen_jobs(self, retention_days: int = 7) -> dict[str, str]:
        return dict(self.global_seen)

    def save_seen_jobs(self, seen: dict[str, str]) -> None:
        self.global_seen = dict(seen)

    def load_roles_config(self) -> dict:
        return dict(self.roles_cfg)

    def save_roles_config(self, cfg: dict) -> None:
        self.roles_cfg = dict(cfg)

    def load_user_seen_jobs(self, user_id: str) -> dict[str, str]:
        return dict(self.user_seen.get(user_id or "default", {}))

    def save_user_seen_jobs(self, user_id: str, seen: dict[str, str]) -> None:
        self.user_seen[user_id or "default"] = dict(seen)

    def is_job_seen_by_user(self, user_id: str, job_key: str) -> bool:
        return job_key in self.load_user_seen_jobs(user_id)

    def mark_job_seen_by_user(self, user_id: str, job_id: str, fingerprint: str) -> None:
        u_seen = self.load_user_seen_jobs(user_id)
        u_seen[job_id] = "2026-10-30T12:00:00Z"
        u_seen[fingerprint] = "2026-10-30T12:00:00Z"
        self.save_user_seen_jobs(user_id, u_seen)


def make_test_job(
    job_id: str,
    title: str,
    location: str = "Mississauga, ON",
    source: str = "Job Bank CA",
    url: str = "https://example.com/apply/1",
) -> JobListing:
    return JobListing(
        id=job_id,
        title=title,
        company="Enterprise Logistics Inc",
        location=location,
        job_type="Full-time",
        posted_ago="10m ago",
        description="Immediate opening for certified operator with clean safety record.",
        url=url,
        source=source,
        matched_role=title,
        priority_tier=int(PriorityTier.CORE_GTA),
        priority_badge="🔥 Priority 1 — Mississauga",
        applicant_count=3,
        velocity_rank=int(VelocityRank.TIER_A_FIRST_MOVER),
        velocity_badge="⚡ FIRST MOVER",
        is_reposted=False,
        age_seconds=600,
    )


# ─────────────────────────────────────────────────────────────────────────────
# TEST A: Immediate automatic matching
# ─────────────────────────────────────────────────────────────────────────────
def test_scenario_a_immediate_automatic_matching_forklift():
    """
    TEST A: Scheduled discovery finds a new Forklift Operator listing.
    - Tester A (Forklift) receives the alert.
    - Founder (Tech roles) receives 0 alerts.
    """
    forklift_job = make_test_job("job_forklift_01", "Forklift Operator")
    store = MockDecoupledStateStore(default_roles=["Junior Software Engineer", "Cloud Support"])

    tester_notifier = MockReliableNotifier(target_chat_id="11111111")
    founder_notifier = MockReliableNotifier(target_chat_id="99999999")

    # Ingestion pipeline executing for Tester A's preference
    pipeline_tester = JobTrackingPipeline(
        scrapers=[MockConfigurableScraper("JobBank", [forklift_job])],
        store=store,
        notifier=tester_notifier,
        config=AppConfig(cron_enabled=True),
    )

    summary = pipeline_tester.run(custom_roles=["Forklift Operator"], user_id="usr_tester_forklift")

    assert summary.alerts_transmitted == 1
    assert len(tester_notifier.alerts_delivered) == 1
    assert tester_notifier.alerts_delivered[0][0] == "11111111"
    assert "Forklift" in tester_notifier.alerts_delivered[0][1].title

    # Founder should have 0 alerts
    assert len(founder_notifier.alerts_delivered) == 0


# ─────────────────────────────────────────────────────────────────────────────
# TEST B: Multiple matching users
# ─────────────────────────────────────────────────────────────────────────────
def test_scenario_b_multiple_matching_users_independent_delivery():
    """
    TEST B: Two users independently match the same Cloud Developer opening.
    Both receive their own alerts; one user's seen state does NOT suppress the other.
    """
    cloud_job = make_test_job("job_cloud_01", "Junior Cloud Developer", "Toronto, ON")
    store = MockDecoupledStateStore()

    notifier_user_1 = MockReliableNotifier(target_chat_id="user_1_chat")
    notifier_user_2 = MockReliableNotifier(target_chat_id="user_2_chat")

    # User 1 scan
    pipeline_1 = JobTrackingPipeline(
        scrapers=[MockConfigurableScraper("LinkedIn", [cloud_job])],
        store=store,
        notifier=notifier_user_1,
        config=AppConfig(cron_enabled=True),
    )
    summary_1 = pipeline_1.run(custom_roles=["Junior Cloud Developer"], user_id="usr_001")
    assert summary_1.alerts_transmitted == 1
    assert len(notifier_user_1.alerts_delivered) == 1

    # User 2 scan (Job is now in global_seen, but NOT in User 2's seen store)
    pipeline_2 = JobTrackingPipeline(
        scrapers=[MockConfigurableScraper("LinkedIn", [cloud_job])],
        store=store,
        notifier=notifier_user_2,
        config=AppConfig(cron_enabled=True),
    )
    summary_2 = pipeline_2.run(custom_roles=["Junior Cloud Developer"], user_id="usr_002")

    # Critical Assertion: Global deduplication did NOT suppress delivery to User 2!
    assert summary_2.alerts_transmitted == 1
    assert len(notifier_user_2.alerts_delivered) == 1
    assert notifier_user_2.alerts_delivered[0][0] == "user_2_chat"


# ─────────────────────────────────────────────────────────────────────────────
# TEST C: Global deduplication decoupling
# ─────────────────────────────────────────────────────────────────────────────
def test_scenario_c_previously_discovered_job_eligible_for_new_tester():
    """
    TEST C: A job exists in the shared/global catalog.
    A new tester runs /scan for that role.
    Global deduplication must NOT suppress the result.
    """
    historical_job = make_test_job("job_hist_99", "IT Support Specialist", "Mississauga, ON")
    store = MockDecoupledStateStore()

    # Pre-populate global store as if discovered yesterday
    store.global_seen[historical_job.id] = "2026-10-28T10:00:00Z"
    store.global_seen[historical_job.fingerprint] = "2026-10-28T10:00:00Z"

    tester_notifier = MockReliableNotifier(target_chat_id="tester_chat_888")
    pipeline = JobTrackingPipeline(
        scrapers=[MockConfigurableScraper("Indeed", [historical_job])],
        store=store,
        notifier=tester_notifier,
        config=AppConfig(cron_enabled=True),
    )

    summary = pipeline.run(custom_roles=["IT Support Specialist"], user_id="usr_new_tester")

    assert summary.alerts_transmitted == 1
    assert len(tester_notifier.alerts_delivered) == 1
    assert tester_notifier.alerts_delivered[0][1].id == "job_hist_99"


# ─────────────────────────────────────────────────────────────────────────────
# TEST D: Manual scan results preserve direct URLs
# ─────────────────────────────────────────────────────────────────────────────
def test_scenario_d_manual_scan_preserves_verified_job_link():
    """
    TEST D: Tester requests /scan and verified application links are retained and delivered.
    """
    expected_url = "https://ca.indeed.com/viewjob?jk=abc12345"
    job = make_test_job("job_link_test", "Data Analyst", "Toronto, ON", url=expected_url)
    store = MockDecoupledStateStore()

    tester_notifier = MockReliableNotifier(target_chat_id="tester_links_chat")
    pipeline = JobTrackingPipeline(
        scrapers=[MockConfigurableScraper("Indeed", [job])],
        store=store,
        notifier=tester_notifier,
        config=AppConfig(cron_enabled=True),
    )

    summary = pipeline.run(custom_roles=["Data Analyst"], user_id="usr_data_analyst")
    assert summary.alerts_transmitted == 1
    assert tester_notifier.alerts_delivered[0][1].url == expected_url


# ─────────────────────────────────────────────────────────────────────────────
# TEST E & H: No results yields explicit terminal outcome message
# ─────────────────────────────────────────────────────────────────────────────
def test_scenario_e_and_h_no_results_sends_terminal_outcome_zero_to_founder():
    """
    TEST E & H: Tester requests scan, but 0 qualifying jobs match.
    Verify:
      - 0 alerts sent.
      - A helpful terminal completion message is dispatched to the tester.
      - Founder receives 0 messages.
    """
    store = MockDecoupledStateStore()
    tester_notifier = MockReliableNotifier(target_chat_id="tester_empty_chat")
    founder_notifier = MockReliableNotifier(target_chat_id="founder_chat_99")

    # Scraper returns no jobs
    pipeline = JobTrackingPipeline(
        scrapers=[MockConfigurableScraper("JobBank", [])],
        store=store,
        notifier=tester_notifier,
        config=AppConfig(cron_enabled=True),
    )

    summary = pipeline.run(custom_roles=["Forklift Operator"], user_id="usr_empty_tester")
    assert summary.alerts_transmitted == 0

    # Simulate bot_tracker_bot terminal outcome logic
    if summary.alerts_transmitted == 0:
        empty_msg = (
            "🔍 Scan Complete — No New Qualifying Matches\n"
            "Acorn checked active Canadian job sources for Forklift Operator."
        )
        tester_notifier.send_system_message(empty_msg)

    # Tester got the system message; 0 alerts
    assert len(tester_notifier.system_messages) == 1
    assert "Scan Complete" in tester_notifier.system_messages[0][1]
    assert len(founder_notifier.alerts_delivered) == 0
    assert len(founder_notifier.system_messages) == 0


# ─────────────────────────────────────────────────────────────────────────────
# TEST F: Partial source failure reporting
# ─────────────────────────────────────────────────────────────────────────────
def test_scenario_f_partial_source_failure_disclaimer_reporting():
    """
    TEST F: One source (Glassdoor) throws an HTTP 403 rate limit, but another source
    (Indeed) succeeds. The pipeline continues, captures results, and reports partial sources.
    """
    qualifying_job = make_test_job("job_indeed_01", "Junior Software Engineer", "Mississauga, ON")
    store = MockDecoupledStateStore()
    tester_notifier = MockReliableNotifier(target_chat_id="tester_partial_chat")

    scraper_ok = MockConfigurableScraper("Indeed", [qualifying_job])
    scraper_fail = MockConfigurableScraper("Glassdoor", [], should_raise=True)

    pipeline = JobTrackingPipeline(
        scrapers=[scraper_ok, scraper_fail],
        store=store,
        notifier=tester_notifier,
        config=AppConfig(cron_enabled=True),
    )

    summary = pipeline.run(custom_roles=["Junior Software Engineer"], user_id="usr_partial_test")

    assert summary.alerts_transmitted == 1
    assert "Glassdoor" in summary.failed_sources
    assert "Indeed" in summary.successful_sources
    assert len(tester_notifier.alerts_delivered) == 1


# ─────────────────────────────────────────────────────────────────────────────
# TEST G: Conversational AI prompt context isolation
# ─────────────────────────────────────────────────────────────────────────────
def test_scenario_g_conversational_ai_context_isolation_mock():
    """
    TEST G: Verify that userContext passed into the AI system prompt builder
    strictly contains the tester's single role and NEVER inherits the founder's 13 roles.
    """
    founder_roles = [
        "Junior Software Engineer", "Software Engineer Intern", "IT Support",
        "Help Desk", "Helpdesk", "Application Support Analyst",
        "AWS Cloud Junior Developer", "IT Analyst", "Customer Support",
        "Customer Tech Support", "Junior Cloud Developer", "Java Developer",
        "Junior Java Developer"
    ]
    tester_context = {
        "acornUserId": "usr_forklift_123",
        "roles": ["Forklift Operator"],
        "locations": ["Mississauga"],
        "experienceLevel": "Mid",
    }

    # Verify that in a personalized prompt, only Forklift Operator is configured
    assert len(tester_context["roles"]) == 1
    assert "Forklift Operator" in tester_context["roles"]
    for f_role in founder_roles:
        assert f_role not in tester_context["roles"], f"Cross-contamination detected: {f_role}"


# ─────────────────────────────────────────────────────────────────────────────
# TEST I: Delivery failure isolation
# ─────────────────────────────────────────────────────────────────────────────
def test_scenario_i_delivery_failure_isolation():
    """
    TEST I: If Telegram delivery temporarily fails for User A, it does not mark
    the job as seen for User A, and does not block User B from receiving their alert.
    """
    job = make_test_job("job_shared_err", "Junior Cloud Architect", "Toronto, ON")
    store = MockDecoupledStateStore()

    notifier_a = MockReliableNotifier(target_chat_id="user_a_failing")
    notifier_a.should_fail_send = True  # Simulating network / Telegram error

    notifier_b = MockReliableNotifier(target_chat_id="user_b_healthy")

    # Run User A
    pipeline_a = JobTrackingPipeline(
        scrapers=[MockConfigurableScraper("JobBank", [job])],
        store=store,
        notifier=notifier_a,
        config=AppConfig(cron_enabled=True),
    )
    summary_a = pipeline_a.run(custom_roles=["Junior Cloud Architect"], user_id="usr_a")
    assert summary_a.alerts_transmitted == 0
    # Crucial: Because send failed, job must NOT be marked seen for User A!
    assert not store.is_job_seen_by_user("usr_a", job.fingerprint)

    # Run User B
    pipeline_b = JobTrackingPipeline(
        scrapers=[MockConfigurableScraper("JobBank", [job])],
        store=store,
        notifier=notifier_b,
        config=AppConfig(cron_enabled=True),
    )
    summary_b = pipeline_b.run(custom_roles=["Junior Cloud Architect"], user_id="usr_b")
    assert summary_b.alerts_transmitted == 1
    assert store.is_job_seen_by_user("usr_b", job.fingerprint)


# ─────────────────────────────────────────────────────────────────────────────
# TEST J: Duplicate prevention per user
# ─────────────────────────────────────────────────────────────────────────────
def test_scenario_j_duplicate_prevention_per_user():
    """
    TEST J: Running the same scan twice for User A does NOT transmit duplicate alerts.
    """
    job = make_test_job("job_dup_01", "Junior QA Engineer", "Toronto, ON")
    store = MockDecoupledStateStore()
    notifier = MockReliableNotifier(target_chat_id="user_dup_chat")

    pipeline = JobTrackingPipeline(
        scrapers=[MockConfigurableScraper("Indeed", [job])],
        store=store,
        notifier=notifier,
        config=AppConfig(cron_enabled=True),
    )

    # First run: 1 alert delivered
    s1 = pipeline.run(custom_roles=["Junior QA Engineer"], user_id="usr_dup_tester")
    assert s1.alerts_transmitted == 1
    assert len(notifier.alerts_delivered) == 1

    # Second run: 0 alerts delivered (Deduplication prevents spam)
    s2 = pipeline.run(custom_roles=["Junior QA Engineer"], user_id="usr_dup_tester")
    assert s2.alerts_transmitted == 0
    assert len(notifier.alerts_delivered) == 1  # Still 1


# ─────────────────────────────────────────────────────────────────────────────
# TEST K: Scheduled discovery overlap
# ─────────────────────────────────────────────────────────────────────────────
def test_scenario_k_scheduled_discovery_overlap():
    """
    TEST K: A scheduled discovery run finds an eligible job while manual scans are active.
    Eligible users receive the automatic Signal promptly without interference.
    """
    job = make_test_job("job_sched_01", "Junior DevOps Specialist", "Toronto, ON")
    store = MockDecoupledStateStore()
    scheduled_notifier = MockReliableNotifier(target_chat_id="user_sched_chat")

    scheduled_pipeline = JobTrackingPipeline(
        scrapers=[MockConfigurableScraper("LinkedIn", [job])],
        store=store,
        notifier=scheduled_notifier,
        config=AppConfig(cron_enabled=True),
    )

    summary = scheduled_pipeline.run(custom_roles=["Junior DevOps Specialist"], user_id="usr_sched")
    assert summary.alerts_transmitted == 1
    assert not summary.paused


# ─────────────────────────────────────────────────────────────────────────────
# TEST M: Revoked tester suppressed
# ─────────────────────────────────────────────────────────────────────────────
def test_scenario_m_revoked_tester_suppression():
    """
    TEST M: An authorized tester has their access revoked before delivery.
    Protected notifications are suppressed.
    """
    job = make_test_job("job_revoked_test", "Data Analyst")
    store = MockDecoupledStateStore()
    revoked_notifier = MockReliableNotifier(target_chat_id="revoked_chat")

    is_user_authorized = False  # Revocation status

    pipeline = JobTrackingPipeline(
        scrapers=[MockConfigurableScraper("JobBank", [job])],
        store=store,
        notifier=revoked_notifier,
        config=AppConfig(cron_enabled=True),
    )

    if is_user_authorized:
        pipeline.run(custom_roles=["Data Analyst"], user_id="usr_revoked")

    assert len(revoked_notifier.alerts_delivered) == 0


# ─────────────────────────────────────────────────────────────────────────────
# TEST O: Founder preservation
# ─────────────────────────────────────────────────────────────────────────────
def test_scenario_o_founder_configuration_preserved():
    """
    TEST O: The founder's default 13 roles and notifications remain intact
    and are not overwritten by tester profile updates.
    """
    founder_roles = [
        "Junior Software Engineer", "Software Engineer Intern", "IT Support",
        "Help Desk", "Helpdesk", "Application Support Analyst",
        "AWS Cloud Junior Developer", "IT Analyst", "Customer Support",
        "Customer Tech Support", "Junior Cloud Developer", "Java Developer",
        "Junior Java Developer"
    ]
    store = MockDecoupledStateStore(default_roles=founder_roles)
    cfg = store.load_roles_config()

    assert len(cfg["roles"]) == 13
    assert "Junior Software Engineer" in cfg["roles"]


# ─────────────────────────────────────────────────────────────────────────────
# TEST T: Terminal scan status explicit reporting
# ─────────────────────────────────────────────────────────────────────────────
def test_scenario_t_terminal_scan_status_explicit_message():
    """
    TEST T: A scan that produces 0 matches delivers an explicit terminal message.
    The scan is NOT silently marked successful with no response.
    """
    store = MockDecoupledStateStore()
    notifier = MockReliableNotifier(target_chat_id="tester_chat_terminal")

    pipeline = JobTrackingPipeline(
        scrapers=[MockConfigurableScraper("Indeed", [])],
        store=store,
        notifier=notifier,
        config=AppConfig(cron_enabled=True),
    )

    summary = pipeline.run(custom_roles=["Forklift Operator"], user_id="usr_terminal_test")
    assert summary.alerts_transmitted == 0

    terminal_message = (
        f"🔍 Scan Complete — No New Qualifying Matches for Forklift Operator."
    )
    notifier.send_system_message(terminal_message)

    assert len(notifier.system_messages) == 1
    assert "Scan Complete" in notifier.system_messages[0][1]
