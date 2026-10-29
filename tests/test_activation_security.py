"""
Unit & Security Tests: Beta Activation Key Generation, Expiration, and Revocation
"""

from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import re
import secrets
import sqlite3

import pytest

KEY_REGEX = re.compile(r"^ACRN-BETA-[a-f0-9]{64}$")


def generate_secure_key() -> str:
    raw_token = secrets.token_hex(32)
    return f"ACRN-BETA-{raw_token}"


def compute_hmac_sha256(raw_key: str, pepper: str) -> str:
    return hmac.new(pepper.encode("utf-8"), raw_key.strip().encode("utf-8"), hashlib.sha256).hexdigest()


@pytest.fixture
def memory_db():
    con = sqlite3.connect(":memory:")
    with open("migrations/0001_acorn_production_auth_and_invites.sql") as f:
        con.executescript(f.read())
    with open("migrations/0002_acorn_beta_activation_keys.sql") as f:
        con.executescript(f.read())
    yield con
    con.close()


def test_key_generation_entropy_and_format():
    key1 = generate_secure_key()
    key2 = generate_secure_key()

    assert key1 != key2
    assert KEY_REGEX.match(key1)
    assert KEY_REGEX.match(key2)
    # 256 bits of entropy = 64 hex characters
    token_part = key1.replace("ACRN-BETA-", "")
    assert len(token_part) == 64


def test_single_use_activation_key_lifecycle(memory_db):
    pepper = "test_server_pepper_123"
    raw_key = generate_secure_key()
    key_hash = compute_hmac_sha256(raw_key, pepper)

    # Insert single-use key
    memory_db.execute(
        """INSERT INTO activation_keys (id, label, key_hash, max_redemptions, redemption_count, created_by)
           VALUES ('key_1', 'Single Tester Key', ?, 1, 0, 'founder')""",
        (key_hash,)
    )
    memory_db.commit()

    # User 1 redeems
    user1_id = "111222333"
    cur = memory_db.execute(
        "UPDATE activation_keys SET redemption_count = redemption_count + 1 WHERE id = 'key_1' AND redemption_count < max_redemptions AND revoked_at IS NULL"
    )
    assert cur.rowcount == 1

    memory_db.execute(
        "INSERT INTO activation_redemptions (id, activation_key_id, telegram_user_id) VALUES ('rdm_1', 'key_1', ?)",
        (user1_id,)
    )
    memory_db.execute(
        "INSERT INTO user_access_grants (id, telegram_user_id, role, status, grant_source, activation_key_id) VALUES ('grnt_1', ?, 'tester', 'active', 'activation_key', 'key_1')",
        (user1_id,)
    )
    memory_db.commit()

    # User 2 attempts redemption with the same single-use key
    user2_id = "999888777"
    cur2 = memory_db.execute(
        "UPDATE activation_keys SET redemption_count = redemption_count + 1 WHERE id = 'key_1' AND redemption_count < max_redemptions AND revoked_at IS NULL"
    )
    assert cur2.rowcount == 0  # REJECTED (Capacity exhausted)

    # Verify user 1 has grant and user 2 does not
    grant1 = memory_db.execute("SELECT status FROM user_access_grants WHERE telegram_user_id = ?", (user1_id,)).fetchone()
    grant2 = memory_db.execute("SELECT status FROM user_access_grants WHERE telegram_user_id = ?", (user2_id,)).fetchone()
    assert grant1[0] == "active"
    assert grant2 is None


def test_key_revocation_prevents_new_redemptions(memory_db):
    pepper = "test_server_pepper_123"
    raw_key = generate_secure_key()
    key_hash = compute_hmac_sha256(raw_key, pepper)

    now_iso = datetime.now(timezone.utc).isoformat()
    memory_db.execute(
        """INSERT INTO activation_keys (id, label, key_hash, max_redemptions, redemption_count, created_by, revoked_at, revoked_by)
           VALUES ('key_rev', 'Revoked Key', ?, 5, 0, 'founder', ?, 'founder')""",
        (key_hash, now_iso)
    )
    memory_db.commit()

    # Attempt redemption
    cur = memory_db.execute(
        "UPDATE activation_keys SET redemption_count = redemption_count + 1 WHERE id = 'key_rev' AND redemption_count < max_redemptions AND revoked_at IS NULL"
    )
    assert cur.rowcount == 0


def test_expired_key_rejection(memory_db):
    pepper = "test_server_pepper_123"
    raw_key = generate_secure_key()
    key_hash = compute_hmac_sha256(raw_key, pepper)

    past_iso = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
    memory_db.execute(
        """INSERT INTO activation_keys (id, label, key_hash, max_redemptions, redemption_count, created_by, redeem_expires_at)
           VALUES ('key_exp', 'Expired Key', ?, 5, 0, 'founder', ?)""",
        (key_hash, past_iso)
    )
    memory_db.commit()

    # Query key check
    key = memory_db.execute(
        "SELECT id, redeem_expires_at FROM activation_keys WHERE key_hash = ?",
        (key_hash,)
    ).fetchone()
    assert key is not None
    is_expired = datetime.fromisoformat(key[1]) < datetime.now(timezone.utc)
    assert is_expired is True


def test_user_revocation_lifecycle(memory_db):
    tg_id = "555444333"
    memory_db.execute(
        """INSERT INTO user_access_grants (id, telegram_user_id, role, status, grant_source)
           VALUES ('grnt_usr', ?, 'tester', 'active', 'founder_direct')""",
        (tg_id,)
    )
    memory_db.commit()

    grant_before = memory_db.execute("SELECT status FROM user_access_grants WHERE telegram_user_id = ?", (tg_id,)).fetchone()
    assert grant_before[0] == "active"

    # Founder revokes user
    now_iso = datetime.now(timezone.utc).isoformat()
    memory_db.execute(
        "UPDATE user_access_grants SET status = 'revoked', revoked_at = ?, revoked_by = 'founder' WHERE telegram_user_id = ?",
        (now_iso, tg_id)
    )
    memory_db.commit()

    grant_after = memory_db.execute("SELECT status FROM user_access_grants WHERE telegram_user_id = ?", (tg_id,)).fetchone()
    assert grant_after[0] == "revoked"
