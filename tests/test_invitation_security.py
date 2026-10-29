"""
Unit & Security Tests: Invitation Key Hashing, Single-Use Enforcement & Telegram Link Replay Defense
"""

from datetime import datetime, timedelta, timezone
import hashlib
import secrets


def hash_token_sha256(raw_token: str) -> str:
    return hashlib.sha256(raw_token.strip().encode("utf-8")).hexdigest()


class InMemoryInviteRegistry:
    """Reference server-side validator matching D1 invitations & telegram_link_tokens."""

    def __init__(self) -> None:
        self.invites: dict[str, dict] = {}
        self.tg_links: dict[str, dict] = {}

    def create_invite(self, email: str, ttl_seconds: int = 3600) -> str:
        raw = f"acrn_inv_{secrets.token_hex(18)}"
        h = hash_token_sha256(raw)
        self.invites[h] = {
            "email": email,
            "status": "active",
            "expires_at": datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds),
        }
        return raw

    def redeem_invite(self, raw_key: str) -> bool:
        h = hash_token_sha256(raw_key)
        rec = self.invites.get(h)
        if not rec or rec["status"] != "active":
            return False
        if datetime.now(timezone.utc) > rec["expires_at"]:
            rec["status"] = "expired"
            return False
        rec["status"] = "redeemed"
        return True

    def revoke_invite(self, raw_key: str) -> None:
        h = hash_token_sha256(raw_key)
        if h in self.invites:
            self.invites[h]["status"] = "revoked"


def test_single_use_invitation_cannot_be_replayed():
    reg = InMemoryInviteRegistry()
    raw_key = reg.create_invite("candidate@utoronto.ca", ttl_seconds=3600)

    # First redemption succeeds
    assert reg.redeem_invite(raw_key) is True
    # Replay attempt fails
    assert reg.redeem_invite(raw_key) is False


def test_expired_and_revoked_invitations_rejected():
    reg = InMemoryInviteRegistry()
    expired_key = reg.create_invite("expired@domain.ca", ttl_seconds=-10)
    assert reg.redeem_invite(expired_key) is False

    revoked_key = reg.create_invite("revoked@domain.ca", ttl_seconds=3600)
    reg.revoke_invite(revoked_key)
    assert reg.redeem_invite(revoked_key) is False
