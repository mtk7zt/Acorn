"""
Scraper Factory Implementation
==============================
GoF Factory Pattern providing instantiated scraper strategies.
"""

from __future__ import annotations

from src.acorn.domain.models import AppConfig
from src.acorn.infrastructure.scrapers.jobbank import JobBankScraper
from src.acorn.infrastructure.scrapers.jobspy_adapter import JobSpyScraper
from src.acorn.infrastructure.scrapers.linkedin import LinkedInGuestScraper
from src.acorn.interfaces.scraper import BaseJobScraper


class ScraperFactory:
    """Factory responsible for instantiating active scraping strategies."""

    @staticmethod
    def create_default_scrapers(config: AppConfig | None = None) -> list[BaseJobScraper]:
        """
        Creates and returns default multi-source scraper collection:
        1. LinkedIn Guest API
        2. Job Bank Canada Official Portal
        3. JobSpy Multi-Board (Indeed, Glassdoor, Google)
        """
        return [
            LinkedInGuestScraper(),
            JobBankScraper(),
            JobSpyScraper(),
        ]
