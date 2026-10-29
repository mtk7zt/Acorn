"""
Acorn Domain Layer Package
==========================
Exports domain models, identity entities, signals, and security tools.
"""

from src.acorn.domain.activity import ActivityEvent, ActivityType
from src.acorn.domain.identity import ChannelBinding, ChannelType, Tenant, User, UserPreferences
from src.acorn.domain.models import (
    AppConfig,
    ATSMatchResult,
    JobListing,
    LocationSpec,
    PriorityTier,
    VelocityRank,
)
from src.acorn.domain.signals import MorningBriefing, Signal, SignalStatus

__all__ = [
    "ActivityEvent",
    "ActivityType",
    "AppConfig",
    "ATSMatchResult",
    "ChannelBinding",
    "ChannelType",
    "JobListing",
    "LocationSpec",
    "MorningBriefing",
    "PriorityTier",
    "Signal",
    "SignalStatus",
    "Tenant",
    "User",
    "UserPreferences",
    "VelocityRank",
]
