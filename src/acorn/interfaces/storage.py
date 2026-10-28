"""
Acorn Storage Interface
=======================
Defines the persistence contracts for deduplication and role configuration.
"""

from abc import ABC, abstractmethod
from typing import Any


class BaseStateStore(ABC):
    """Abstract Repository for persisting deduplication state and configuration."""

    @abstractmethod
    def load_seen_jobs(self, retention_days: int = 7) -> dict[str, str]:
        """Loads and auto-prunes seen job identifiers."""
        pass

    @abstractmethod
    def save_seen_jobs(self, seen: dict[str, str]) -> None:
        """Atomically persists seen job mapping to storage."""
        pass

    @abstractmethod
    def load_roles_config(self) -> dict[str, Any]:
        """Loads the active tracked roles configuration."""
        pass

    @abstractmethod
    def save_roles_config(self, cfg: dict[str, Any]) -> None:
        """Atomically persists updated tracked roles configuration."""
        pass
