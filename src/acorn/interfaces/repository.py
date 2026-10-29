"""
Acorn Interfaces: Repository Layer
==================================
Defines abstract contracts for Opportunity, User, Signal,
and Activity persistence across SQLite, PostgreSQL, and Cloudflare D1.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional

from src.acorn.domain.activity import ActivityEvent
from src.acorn.domain.identity import User
from src.acorn.domain.models import JobListing
from src.acorn.domain.signals import Signal, SignalStatus


class IOpportunityRepository(ABC):
    """Abstract interface for canonical opportunity persistence and deduplication."""

    @abstractmethod
    def save_opportunity(self, job: JobListing) -> None:
        """Persists or updates a canonical opportunity."""
        pass

    @abstractmethod
    def get_by_fingerprint(self, fingerprint: str) -> Optional[JobListing]:
        """Retrieves an opportunity by its canonical SHA-256 fingerprint."""
        pass

    @abstractmethod
    def get_by_id(self, job_id: str) -> Optional[JobListing]:
        """Retrieves an opportunity by its raw source ID."""
        pass

    @abstractmethod
    def exists(self, key: str) -> bool:
        """Returns True if either source ID or canonical fingerprint exists."""
        pass

    @abstractmethod
    def list_recent(self, limit: int = 100) -> list[JobListing]:
        """Lists recent opportunities sorted by discovery timestamp."""
        pass


class IUserRepository(ABC):
    """Abstract interface for multi-tenant users and preferences."""

    @abstractmethod
    def save_user(self, user: User) -> None:
        """Creates or updates a user profile and preferences."""
        pass

    @abstractmethod
    def get_user(self, user_id: str) -> Optional[User]:
        """Retrieves a user by ID."""
        pass

    @abstractmethod
    def get_user_by_telegram_chat(self, chat_id: str) -> Optional[User]:
        """Looks up a user bound to a specific Telegram chat ID."""
        pass

    @abstractmethod
    def list_users(self) -> list[User]:
        """Returns all registered users."""
        pass


class ISignalRepository(ABC):
    """Abstract interface for personalized career signals and delivery states."""

    @abstractmethod
    def save_signal(self, signal: Signal) -> None:
        """Stores a personalized signal."""
        pass

    @abstractmethod
    def get_signal(self, signal_id: str) -> Optional[Signal]:
        """Retrieves a signal by ID."""
        pass

    @abstractmethod
    def list_signals_for_user(
        self,
        user_id: str,
        status: Optional[SignalStatus] = None,
        limit: int = 50,
    ) -> list[Signal]:
        """Lists signals for a specific user, optionally filtered by status."""
        pass

    @abstractmethod
    def update_signal_status(self, signal_id: str, status: SignalStatus) -> bool:
        """Updates the status of an existing signal."""
        pass


class IActivityRepository(ABC):
    """Abstract interface for audit logging and activity stream."""

    @abstractmethod
    def log_activity(self, event: ActivityEvent) -> None:
        """Appends an immutable audit event."""
        pass

    @abstractmethod
    def list_activity_for_user(
        self,
        user_id: str,
        limit: int = 50,
    ) -> list[ActivityEvent]:
        """Lists activity events for a user in reverse chronological order."""
        pass

    @abstractmethod
    def purge_for_user(self, user_id: str) -> int:
        """Wipes all activity records for a user (Data Sovereignty)."""
        pass
