"""
Acorn Domain Exceptions
=======================
Custom exception hierarchy for the Acorn framework.
"""


class AcornException(Exception):
    """Base exception for all domain and infrastructure failures."""
    pass


class ConfigurationError(AcornException):
    """Raised when required configuration or secrets are missing or malformed."""
    pass


class StateStorageError(AcornException):
    """Raised when atomic reading or writing of state files fails."""
    pass


class ScraperExecutionError(AcornException):
    """Raised when a job portal scraping engine encounters an unrecoverable fault."""
    pass


class NotificationError(AcornException):
    """Raised when message dispatching to Telegram fails."""
    pass
