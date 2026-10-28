"""
Acorn Configuration Manager
===========================
Loads, merges, and validates runtime configuration from JSON and environment.
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any

from src.acorn.domain.models import AppConfig

logger = logging.getLogger("acorn.config")


class ConfigurationManager:
    """Manages application lifecycle settings."""

    @staticmethod
    def load_app_config(config_path: Path) -> AppConfig:
        """Loads configuration from bot_config.json with environment variable overrides."""
        cfg = AppConfig()

        if config_path.exists():
            try:
                data = json.loads(config_path.read_text(encoding="utf-8"))
                if isinstance(data, dict):
                    if "max_age_seconds" in data:
                        cfg.max_age_seconds = int(data["max_age_seconds"])
                    if "cron_enabled" in data:
                        cfg.cron_enabled = bool(data["cron_enabled"])
                    if "priority_1_locations" in data and isinstance(data["priority_1_locations"], list):
                        cfg.priority_1_locations = [str(x).lower().strip() for x in data["priority_1_locations"]]
                    if "priority_2_locations" in data and isinstance(data["priority_2_locations"], list):
                        cfg.priority_2_locations = [str(x).lower().strip() for x in data["priority_2_locations"]]
                    if "excluded_senior_keywords" in data and isinstance(data["excluded_senior_keywords"], list):
                        cfg.excluded_senior_keywords = [str(x).lower().strip() for x in data["excluded_senior_keywords"]]
                    if "junior_override_keywords" in data and isinstance(data["junior_override_keywords"], list):
                        cfg.junior_override_keywords = [str(x).lower().strip() for x in data["junior_override_keywords"]]
            except Exception as exc:
                logger.warning("Could not parse config from %s: %s; using standard defaults.", config_path, exc)

        # Environment variable overrides
        env_max_age = os.getenv("MAX_AGE_SECONDS")
        if env_max_age and env_max_age.isdigit():
            cfg.max_age_seconds = int(env_max_age)

        return cfg
