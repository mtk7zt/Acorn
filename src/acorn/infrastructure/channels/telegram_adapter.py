"""
Acorn Infrastructure: Multi-Tenant Telegram Channel Adapter
===========================================================
Implements omnichannel delivery binding Acorn Core career intelligence
(Signals, Morning Briefings, ATS Fit Checks) to user Telegram clients.
"""

from __future__ import annotations

import logging
from typing import Optional

from src.acorn.domain.activity import ActivityEvent
from src.acorn.domain.identity import User
from src.acorn.domain.signals import MorningBriefing, Signal
from src.acorn.infrastructure.notifiers.telegram import TelegramNotifier

logger = logging.getLogger("acorn.channels.telegram")


class TelegramChannelAdapter:
    """Delivers personal career signals and briefings to Telegram users."""

    def __init__(self, bot_token: str):
        self.bot_token = bot_token.strip()

    def get_notifier_for_user(self, user: User) -> Optional[TelegramNotifier]:
        """Resolves a TelegramNotifier bound to the user's registered chat ID."""
        chat_id = user.get_telegram_chat_id()
        if not chat_id:
            logger.debug("User %s has no active Telegram channel binding.", user.id)
            return None
        return TelegramNotifier(bot_token=self.bot_token, chat_id=chat_id)

    def dispatch_signal(self, user: User, signal: Signal) -> bool:
        """Dispatches a personalized career Signal to the user's Telegram."""
        notifier = self.get_notifier_for_user(user)
        if not notifier or not signal.job:
            return False
        return notifier.send_alert(signal.job)

    def dispatch_briefing(self, user: User, briefing: MorningBriefing) -> bool:
        """Dispatches a formatted Morning Briefing with on-demand interactive controls."""
        notifier = self.get_notifier_for_user(user)
        if not notifier:
            return False

        text = briefing.to_summary_text()
        keyboard = {
            "inline_keyboard": [
                [{"text": "🔍 Scan All Target Roles", "callback_data": "scan_roles"}],
                [
                    {"text": "➕ Add Job Role", "callback_data": "add_role_prompt"},
                    {"text": "📋 Manage Roles", "callback_data": "list_roles"},
                ],
                [
                    {"text": "📄 ATS Resume Check", "callback_data": "ats_prompt"},
                    {"text": "🗑️ Wipe My Data", "callback_data": "wipe_prompt"},
                ],
            ]
        }
        payload = {
            "chat_id": notifier.chat_id,
            "text": text,
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
            "reply_markup": keyboard,
        }
        return notifier._post_telegram(payload)

    def dispatch_system_message(self, user: User, text: str) -> bool:
        """Sends an administrative or status message to the user."""
        notifier = self.get_notifier_for_user(user)
        if not notifier:
            return False
        return notifier.send_system_message(text)
