"""
Acorn Scraper Interface
=======================
Defines the contract for all external job board scraping adapters.
"""

from abc import ABC, abstractmethod
from src.acorn.domain.models import JobListing, LocationSpec


class BaseJobScraper(ABC):
    """Abstract Strategy representing an individual job board harvester."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable identifier of the job provider."""
        pass

    @abstractmethod
    def scrape(
        self,
        role: str,
        location: LocationSpec,
        max_age_seconds: int,
    ) -> list[JobListing]:
        """
        Executes a targeted query against the external portal.

        :param role: Target job title designation.
        :param location: Target geographic jurisdiction.
        :param max_age_seconds: Maximum age threshold in seconds.
        :return: List of freshly discovered JobListing domain entities.
        """
        pass
