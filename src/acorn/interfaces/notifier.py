"""
Acorn Notifier Interface
========================
Defines the messaging contract for outbound job alerts.
"""

from abc import ABC, abstractmethod
from src.acorn.domain.models import JobListing


class BaseNotifier(ABC):
    """Abstract Notifier handling formatted alert delivery to clients."""

    @abstractmethod
    def send_alert(self, job: JobListing) -> bool:
        """
        Dispatches a structured, sanitized alert for an individual opening.

        :param job: Discovered job listing entity.
        :return: True if delivery was acknowledged by gateway.
        """
        pass

    @abstractmethod
    def send_system_message(self, text: str) -> bool:
        """
        Transmits an administrative or diagnostic system message.

        :param text: Text content to transmit.
        :return: True if delivery was acknowledged.
        """
        pass
