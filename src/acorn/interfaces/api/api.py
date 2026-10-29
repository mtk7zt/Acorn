"""
Acorn Core: FastAPI REST API Gateway (Omnichannel & SaaS-Ready)
===============================================================
Exposes secure REST endpoints for Web, Mobile, Telegram, and IaaS consumers:
  - GET  /v1/health             -> Engine & persistence health status
  - GET  /v1/signals            -> Active personalized career signals
  - POST /v1/signals/{id}/action -> Mark signal as saved, applied, or dismissed
  - GET  /v1/briefings/latest   -> Curated Morning Briefing
  - POST /v1/briefings/scan     -> On-demand background scan across all target roles
  - POST /v1/fit/evaluate       -> Zero-PII grounded ATS match & XYZ bullet co-pilot
  - GET  /v1/activity           -> Human-readable audit trail ("Kept watch")
  - POST /v1/users              -> Create / update user preferences & channel bindings
  - DELETE /v1/privacy/data     -> Data Sovereignty Protocol (full purge)
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Optional

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from src.acorn.application.services.briefing_service import BriefingService
from src.acorn.application.services.matching_service import MatchingService
from src.acorn.domain.activity import ActivityEvent, ActivityType
from src.acorn.domain.identity import ChannelBinding, ChannelType, User, UserPreferences
from src.acorn.domain.models import JobListing, PriorityTier, VelocityRank
from src.acorn.domain.security import (
    analyze_job_description,
    evaluate_ats_resume_match,
    evaluate_resume_with_actionable_edits,
    purge_user_data,
)
from src.acorn.domain.signals import SignalStatus
from src.acorn.infrastructure.persistence.sqlite_repo import SqliteAcornRepository

DB_FILE = os.getenv("ACORN_DB_PATH", "acorn.db")
repo_instance = SqliteAcornRepository(db_path=DB_FILE)


def get_repo() -> SqliteAcornRepository:
    return repo_instance


def get_or_create_default_user(repo: SqliteAcornRepository = Depends(get_repo)) -> User:
    """Resolves or provisions default user for single-tenant or unauthenticated requests."""
    default_id = os.getenv("ACORN_DEFAULT_USER_ID", "usr_founder_001")
    user = repo.get_user(default_id)
    if not user:
        user = User(
            id=default_id,
            tenant_id="tenant_default",
            display_name="Founder Candidate",
            email="candidate@acorn.local",
            preferences=UserPreferences(
                target_roles=[
                    "Junior Software Engineer",
                    "Software Engineer Intern",
                    "IT Support Specialist",
                    "Help Desk Technician",
                    "Junior Cloud Developer",
                    "Junior Java Developer",
                ],
                allow_remote_canada=True,
            ),
        )
        repo.save_user(user)
    return user


# ─────────────────────────────────────────────────────────────────────────────
# Request & Response Schemas
# ─────────────────────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str
    version: str
    database: str
    total_opportunities: int


class ActionRequest(BaseModel):
    action: str = Field(..., description="'saved', 'applied', or 'dismissed'")


class ATSEvaluationRequest(BaseModel):
    resume_text: str = Field(..., description="Raw candidate resume text (stripped in-memory)")
    job_description: str = Field("", description="Target job description")
    job_title: str = Field("Software Engineer", description="Target job title")


class ATSEvaluationResponse(BaseModel):
    match_score: int
    matched_keywords: list[str]
    missing_keywords: list[str]
    xyz_bullet_recommendations: list[str]
    summary_analysis: str


class JDAnalyzeRequest(BaseModel):
    jd_text: str = Field(..., description="Raw text of the job description")
    job_title: str = Field("", description="Optional job title")


class ResumeEvaluateRequest(BaseModel):
    resume_text: str = Field(..., description="Raw candidate resume text (stripped in-memory)")
    jd_text: str = Field("", description="Target job description")
    job_title: str = Field("Target Position", description="Target job title")



class UpdateUserRequest(BaseModel):
    display_name: Optional[str] = None
    email: Optional[str] = None
    target_roles: Optional[list[str]] = None
    allow_remote_canada: Optional[bool] = None
    telegram_chat_id: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
# Application Factory
# ─────────────────────────────────────────────────────────────────────────────

def create_app(repo: Optional[SqliteAcornRepository] = None) -> FastAPI:
    app = FastAPI(
        title="Acorn Core API",
        version="2.0.0",
        description="Omnichannel Personal Career Intelligence Engine",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    current_repo = repo or repo_instance
    app.dependency_overrides[get_repo] = lambda: current_repo

    @app.get("/v1/health", response_model=HealthResponse)
    def health_check():
        recent = current_repo.list_recent(limit=1)
        return HealthResponse(
            status="healthy",
            version="2.0.0",
            database="sqlite_active",
            total_opportunities=len(current_repo.list_recent(limit=500)),
        )

    @app.get("/v1/signals")
    def list_signals(
        status_filter: Optional[str] = None,
        user: User = Depends(get_or_create_default_user),
    ):
        sig_status = None
        if status_filter:
            try:
                sig_status = SignalStatus(status_filter.lower())
            except ValueError:
                pass
        signals = current_repo.list_signals_for_user(user.id, status=sig_status, limit=50)
        return [
            {
                "id": s.id,
                "job": s.job.to_dict() if s.job else None,
                "status": s.status.value,
                "fit_score": s.fit_score,
                "fit_reasons": s.fit_reasons,
                "velocity_summary": s.velocity_summary,
                "surfaced_at": s.surfaced_at,
            }
            for s in signals
        ]

    @app.post("/v1/signals/{signal_id}/action")
    def take_signal_action(
        signal_id: str,
        body: ActionRequest,
        user: User = Depends(get_or_create_default_user),
    ):
        sig = current_repo.get_signal(signal_id)
        if not sig or sig.user_id != user.id:
            raise HTTPException(status_code=404, detail="Signal not found")

        action = body.action.lower()
        if action == "applied":
            current_repo.update_signal_status(signal_id, SignalStatus.APPLIED)
        elif action == "saved":
            current_repo.update_signal_status(signal_id, SignalStatus.SAVED)
        elif action == "dismissed":
            current_repo.update_signal_status(signal_id, SignalStatus.DISMISSED)
        else:
            raise HTTPException(status_code=400, detail="Invalid action. Use 'saved', 'applied', or 'dismissed'.")

        return {"status": "success", "signal_id": signal_id, "new_status": action}

    @app.get("/v1/briefings/latest")
    def get_latest_briefing(user: User = Depends(get_or_create_default_user)):
        briefing_svc = BriefingService(
            signal_repo=current_repo,
            activity_repo=current_repo,
            opportunity_repo=current_repo,
        )
        briefing = briefing_svc.get_latest_briefing(user)
        return {
            "id": briefing.id,
            "headline": briefing.headline,
            "subheadline": briefing.subheadline,
            "summary_text": briefing.to_summary_text(),
            "signal_count": briefing.signal_count,
            "signals": [
                {
                    "id": s.id,
                    "title": s.job.title if s.job else "",
                    "company": s.job.company if s.job else "",
                    "location": s.job.location if s.job else "",
                    "url": s.job.url if s.job else "",
                    "fit_score": s.fit_score,
                    "fit_reasons": s.fit_reasons,
                    "velocity_badge": s.job.velocity_badge if s.job else "",
                }
                for s in briefing.signals
            ],
            "created_at": briefing.created_at,
        }

    @app.post("/v1/briefings/scan")
    def trigger_on_demand_scan(user: User = Depends(get_or_create_default_user)):
        """Evaluates all target roles for the user and returns fresh Signals."""
        matching_svc = MatchingService(
            opportunity_repo=current_repo,
            signal_repo=current_repo,
            activity_repo=current_repo,
        )
        match_res = matching_svc.evaluate_user(user)

        briefing_svc = BriefingService(
            signal_repo=current_repo,
            activity_repo=current_repo,
            opportunity_repo=current_repo,
        )
        briefing = briefing_svc.get_latest_briefing(user)
        return {
            "scanned_opportunities": match_res.opportunities_screened,
            "new_signals_found": len(match_res.signals_surfaced),
            "suppressed_saturated": match_res.suppressed_count,
            "briefing": {
                "headline": briefing.headline,
                "summary_text": briefing.to_summary_text(),
                "signal_count": briefing.signal_count,
            },
        }

    @app.post("/v1/fit/evaluate", response_model=ATSEvaluationResponse)
    def evaluate_fit(body: ATSEvaluationRequest):
        """Zero-PII ATS resume evaluation with high-impact Google XYZ bullet suggestions."""
        res = evaluate_ats_resume_match(
            resume_text=body.resume_text,
            job_description=body.job_description,
            job_title=body.job_title,
        )
        return ATSEvaluationResponse(
            match_score=res.match_score,
            matched_keywords=res.matched_keywords,
            missing_keywords=res.missing_keywords,
            xyz_bullet_recommendations=res.xyz_bullet_recommendations,
            summary_analysis=res.summary_analysis,
        )

    @app.post("/v1/jd/analyze")
    def analyze_jd(body: JDAnalyzeRequest):
        """
        Systematically analyzes a Job Description (JD):
        Extracts trending ATS keywords, categorizes competencies, and crafts
        high-impact Google XYZ statements with business value and numerical metrics.
        """
        return analyze_job_description(jd_text=body.jd_text, job_title=body.job_title)

    @app.post("/v1/resume/evaluate")
    def evaluate_resume_and_prescribe_edits(body: ResumeEvaluateRequest):
        """
        Evaluates candidate resume against target JD:
        Calculates ATS compatibility score, pinpoints exact missing skills,
        and provides line-by-line actionable edits and impact bullets.
        """
        return evaluate_resume_with_actionable_edits(
            resume_text=body.resume_text,
            jd_text=body.jd_text,
            job_title=body.job_title,
        )


    @app.get("/v1/activity")
    def get_activity_log(
        limit: int = 50,
        user: User = Depends(get_or_create_default_user),
    ):
        events = current_repo.list_activity_for_user(user.id, limit=limit)
        return [
            {
                "id": e.id,
                "event_type": e.event_type.value,
                "headline": e.headline,
                "description": e.description,
                "details": e.details,
                "created_at": e.created_at,
            }
            for e in events
        ]

    @app.post("/v1/users")
    def update_user_preferences(
        body: UpdateUserRequest,
        user: User = Depends(get_or_create_default_user),
    ):
        if body.display_name:
            user.display_name = body.display_name
        if body.email:
            user.email = body.email
        if body.target_roles is not None:
            user.preferences.target_roles = [r.strip() for r in body.target_roles if r.strip()]
        if body.allow_remote_canada is not None:
            user.preferences.allow_remote_canada = body.allow_remote_canada
        if body.telegram_chat_id:
            # Bind or update Telegram channel
            existing = False
            for ch in user.channels:
                if ch.channel_type == ChannelType.TELEGRAM:
                    ch.address = body.telegram_chat_id
                    ch.is_active = True
                    existing = True
            if not existing:
                user.channels.append(ChannelBinding(
                    channel_type=ChannelType.TELEGRAM,
                    address=body.telegram_chat_id,
                ))

        current_repo.save_user(user)
        return {
            "status": "updated",
            "user_id": user.id,
            "target_roles": user.preferences.target_roles,
            "telegram_chat_id": user.get_telegram_chat_id(),
        }

    @app.delete("/v1/privacy/data")
    def purge_user_account(user: User = Depends(get_or_create_default_user)):
        """Complete Data Sovereignty Purge."""
        purged_records = current_repo.purge_for_user(user.id)
        purge_res = purge_user_data(user.id)
        return {
            "status": "purged",
            "user_id": user.id,
            "records_deleted": purged_records,
            "memory_status": purge_res["message"],
        }

    return app


app = create_app()
