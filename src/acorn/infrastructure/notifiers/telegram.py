"""
Telegram Alert & Notification Gateway (3-Row Interactive Keyboard & ATS Co-Pilot)
================================================================================
Implements BaseNotifier with rigorous HTML entity sanitization (VULN-04 Remediation),
applicant velocity badging, and 3-row interactive inline keyboards.
"""

from __future__ import annotations

import html
import logging
import re
import time
from typing import Any

try:
    from bs4 import BeautifulSoup
except ImportError:
    BeautifulSoup = None

import requests

from src.acorn.domain.models import JobListing
from src.acorn.interfaces.notifier import BaseNotifier

logger = logging.getLogger("acorn.notifier")


class TelegramNotifier(BaseNotifier):
    """Encapsulates secure Telegram alert dispatching with 3-row keyboards."""

    def __init__(self, bot_token: str, chat_id: str, max_retries: int = 3):
        self.bot_token = bot_token.strip()
        self.chat_id = chat_id.strip()
        self.max_retries = max_retries
        self.api_url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"

    @staticmethod
    def sanitize_plain_text(raw_text: str | None, max_length: int = 260, fallback: str = "") -> str:
        """
        Strips HTML and markdown characters and truncates to a crisp summary.
        (VULN-04 Remediation)
        """
        if not raw_text or str(raw_text).strip().lower() in ("nan", "none", ""):
            return fallback or "Click the direct job link below to view full responsibilities and apply."

        if BeautifulSoup is not None:
            text = BeautifulSoup(str(raw_text), "html.parser").get_text(" ", strip=True)
        else:
            text = re.sub(r"<[^>]+>", " ", str(raw_text))
            text = html.unescape(text)

        text = re.sub(r"[*_`#>-]+", " ", text)
        text = re.sub(r"\s+", " ", text).strip()

        if not text:
            return fallback or "Click the direct job link below to view full responsibilities and apply."

        if len(text) <= max_length:
            return text

        truncated = text[:max_length].rsplit(" ", 1)[0].rstrip(".,;:")
        return f"{truncated}..."

    def format_job_html(self, job: JobListing) -> str:
        """
        Formats a JobListing entity into safe Telegram HTML with deterministic escaping
        and velocity badging. (VULN-04 Remediation)
        """
        safe_priority = html.escape(job.priority_badge)
        safe_velocity = html.escape(job.velocity_badge)
        safe_title = html.escape(job.title)
        safe_company = html.escape(job.company)
        safe_location = html.escape(job.location)
        safe_type = html.escape(job.job_type)
        safe_posted = html.escape(job.posted_ago)
        safe_source = html.escape(job.source)
        safe_role = html.escape(job.matched_role)
        safe_desc = html.escape(self.sanitize_plain_text(job.description))
        safe_url = html.escape(job.url)

        applicants_text = (
            f"{job.applicant_count} applicants"
            if job.applicant_count is not None
            else "Active Window"
        )
        safe_applicants = html.escape(applicants_text)

        return (
            f"<b>{safe_priority}</b>\n"
            f"<b>{safe_velocity}</b>\n\n"
            f"💼 <b>{safe_title}</b>\n"
            f"🏢 <b>Company:</b> {safe_company}\n"
            f"📍 <b>Location:</b> {safe_location}\n"
            f"🕒 <b>Posted:</b> {safe_posted}  |  👥 <b>Applicants:</b> {safe_applicants}\n"
            f"📋 <b>Type:</b> {safe_type}  |  🔎 <b>Source:</b> {safe_source} <i>({safe_role})</i>\n\n"
            f"📝 <b>Mini Description:</b>\n{safe_desc}\n\n"
            f"🔗 <b>Direct Job Link:</b> <a href=\"{safe_url}\">{safe_url}</a>"
        )

    @staticmethod
    def build_3row_keyboard(
        job_url: str | None = None,
        source_name: str = "Job Board",
        job_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Constructs the Acorn interactive Telegram inline keyboard:
          Row 1: [🚀 Apply on <Source>] [🎯 Check ATS Fit]
          Row 2: [🔍 Scan All Target Roles]
          Row 3: [➕ Add Job Role] [📋 Manage Roles]
          Row 4: [📄 ATS Resume Check] [🗑️ Wipe My Data]
        """
        rows: list[list[dict[str, str]]] = []

        # Row 1: Direct Apply & Fit Check
        top_row = []
        if job_url:
            top_row.append({"text": f"🚀 Apply on {source_name}", "url": job_url})
        if job_id:
            top_row.append({"text": "🎯 Check ATS Fit", "callback_data": f"fit_{job_id}"})
        if top_row:
            rows.append(top_row)

        # Row 2: Scan All Target Roles & Breakdown JD
        rows.append([
            {"text": "🔍 Scan All Roles", "callback_data": "scan_roles"},
            {"text": "📋 Breakdown JD", "callback_data": "jd_prompt"},
        ])

        # Row 3: Dynamic Role Management
        rows.append([
            {"text": "➕ Add Job Role", "callback_data": "add_role_prompt"},
            {"text": "📋 Manage Roles", "callback_data": "list_roles"},
        ])

        # Row 4: Zero-PII Grounded ATS & Data Sovereignty
        rows.append([
            {"text": "📄 Scan Resume (ATS)", "callback_data": "ats_prompt"},
            {"text": "🗑️ Wipe My Data", "callback_data": "wipe_prompt"},
        ])

        return {"inline_keyboard": rows}

    def _post_telegram(self, payload: dict[str, Any]) -> bool:
        """Posts payload to Telegram with exponential backoff on 429."""
        attempt = 0
        backoff = 1.0

        while attempt < self.max_retries:
            attempt += 1
            try:
                resp = requests.post(self.api_url, json=payload, timeout=15)
                if resp.status_code == 200:
                    return True
                if resp.status_code == 429:
                    retry_after = int(resp.json().get("parameters", {}).get("retry_after", backoff))
                    logger.warning("Telegram rate-limited (429). Retrying after %d seconds...", retry_after)
                    time.sleep(retry_after)
                    continue

                logger.error("Telegram API HTTP %d error: %s", resp.status_code, resp.text)
                return False
            except Exception as exc:
                logger.error("Network fault during Telegram dispatch: %s (attempt %d/%d)", exc, attempt, self.max_retries)
                time.sleep(backoff)
                backoff *= 2

        return False

    def send_alert(self, job: JobListing) -> bool:
        """Transmits a formatted job alert with 3-row interactive controls."""
        payload = {
            "chat_id": self.chat_id,
            "text": self.format_job_html(job),
            "parse_mode": "HTML",
            "disable_web_page_preview": False,
            "reply_markup": self.build_3row_keyboard(job.url, job.source, job_id=job.id),
        }
        return self._post_telegram(payload)

    def send_system_message(self, text: str) -> bool:
        """Transmits an administrative or diagnostic system message."""
        payload = {
            "chat_id": self.chat_id,
            "text": text,
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
        }
        return self._post_telegram(payload)
