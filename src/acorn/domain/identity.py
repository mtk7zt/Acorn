"""
Acorn Domain: Multi-Tenant Identity & User Preferences
======================================================
Defines organizations (tenants), users, career preferences,
and multi-surface communication channel bindings.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
import uuid
from typing import Any


class ChannelType(str, Enum):
    """Supported communication delivery channels."""
    TELEGRAM = "telegram"
    WEB = "web"
    REST = "rest"
    MOBILE = "mobile"


@dataclass
class ChannelBinding:
    """Binds a user account to a messaging channel or client address."""
    channel_type: ChannelType
    address: str  # e.g., Telegram chat_id or web session token
    is_active: bool = True
    metadata: dict[str, Any] = field(default_factory=dict)
    linked_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


@dataclass
class UserPreferences:
    """Personalized career search, geofencing, and notification preferences."""
    target_roles: list[str] = field(default_factory=lambda: [
        "Junior Software Engineer",
        "IT Support Specialist",
        "Help Desk Technician",
        "Junior Cloud Developer",
        "Junior Java Developer",
    ])
    priority_1_locations: list[str] = field(default_factory=lambda: [
        "mississauga", "toronto", "etobicoke", "north york",
        "scarborough", "east york", "york"
    ])
    priority_2_locations: list[str] = field(default_factory=lambda: [
        "brampton", "oakville", "burlington", "milton", "vaughan",
        "markham", "richmond hill", "peel", "halton", "gta"
    ])
    allow_remote_canada: bool = True
    excluded_senior_keywords: list[str] = field(default_factory=lambda: [
        "senior", "sr.", "sr ", "staff", "principal", "director",
        "vp ", "vice president", "head of", "architect", "manager", "lead"
    ])
    junior_override_keywords: list[str] = field(default_factory=lambda: [
        "junior", "jr", "intern", "internship", "co-op", "coop",
        "entry", "associate", "graduate", "level 1", "tier 1", "l1"
    ])
    max_applicants_threshold: int = 40
    first_mover_threshold: int = 5
    daily_briefing_time_utc: str = "13:00"  # 9:00 AM EDT
    instant_alert_tier_a: bool = True
    cadence: str = "realtime"  # "realtime" | "hourly" | "daily_briefing_only"


@dataclass
class User:
    """User account entity representing a job seeker."""
    id: str = field(default_factory=lambda: f"usr_{uuid.uuid4().hex[:12]}")
    tenant_id: str = "tenant_default"
    email: str = ""
    display_name: str = "Job Seeker"
    preferences: UserPreferences = field(default_factory=UserPreferences)
    channels: list[ChannelBinding] = field(default_factory=list)
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    is_active: bool = True

    def get_telegram_chat_id(self) -> str | None:
        """Returns the primary active Telegram chat ID if bound."""
        for ch in self.channels:
            if ch.channel_type == ChannelType.TELEGRAM and ch.is_active:
                return ch.address
        return None


@dataclass
class Tenant:
    """Organization or workspace boundary for enterprise / multi-tenant SaaS."""
    id: str = field(default_factory=lambda: f"ten_{uuid.uuid4().hex[:8]}")
    name: str = "Default Workspace"
    plan: str = "founder_preview"
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    is_active: bool = True
