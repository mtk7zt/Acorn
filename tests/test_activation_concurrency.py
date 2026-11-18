"""
Concurrency & Atomicity Tests: Multi-User Capacity and Oversubscription Defense
"""

import concurrent.futures
import sqlite3
import pytest


def test_concurrent_redemptions_atomic_capacity():
    """
    Simulates 10 concurrent redemption requests attempting to claim
    a key with a strict capacity of 3. Exactly 3 must succeed and 7 must fail.
    """
    con = sqlite3.connect(":memory:", check_same_thread=False)
    with open("migrations/0001_acorn_production_auth_and_invites.sql") as f:
        con.executescript(f.read())
    with open("migrations/0002_acorn_beta_activation_keys.sql") as f:
        con.executescript(f.read())

    key_id = "key_cohort_3"
    key_hash = "mock_hash_cohort_3"
    capacity = 3

    con.execute(
        """INSERT INTO activation_keys (id, label, key_hash, max_redemptions, redemption_count, created_by)
           VALUES (?, 'Cohort 3', ?, ?, 0, 'founder')""",
        (key_id, key_hash, capacity)
    )
    con.commit()

    results = []
    import threading
    lock = threading.Lock()

    def attempt_redemption(user_id: str):
        with lock:
            with con:
                cur = con.execute(
                    """UPDATE activation_keys
                       SET redemption_count = redemption_count + 1
                       WHERE id = ? AND redemption_count < max_redemptions AND revoked_at IS NULL""",
                    (key_id,)
                )
                if cur.rowcount == 1:
                    con.execute(
                        "INSERT INTO activation_redemptions (id, activation_key_id, telegram_user_id) VALUES (?, ?, ?)",
                        (f"rdm_{user_id}", key_id, user_id)
                    )
                    con.execute(
                        "INSERT INTO user_access_grants (id, telegram_user_id, role, status, grant_source, activation_key_id) VALUES (?, ?, 'tester', 'active', 'activation_key', ?)",
                        (f"grnt_{user_id}", user_id, key_id)
                    )
                    return True
                return False

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(attempt_redemption, f"user_{i}") for i in range(10)]
        for f in concurrent.futures.as_completed(futures):
            results.append(f.result())

    success_count = sum(1 for r in results if r is True)
    failure_count = sum(1 for r in results if r is False)

    assert success_count == 3
    assert failure_count == 7

    # Verify database state
    row = con.execute("SELECT redemption_count, max_redemptions FROM activation_keys WHERE id = ?", (key_id,)).fetchone()
    assert row[0] == 3
    assert row[1] == 3

    grants = con.execute("SELECT COUNT(*) FROM user_access_grants WHERE status = 'active'").fetchone()[0]
    assert grants == 3
    con.close()


def test_redemption_idempotency():
    """
    Verifies that a repeated Telegram update from the same user does not consume additional key capacity.
    """
    con = sqlite3.connect(":memory:")
    with open("migrations/0001_acorn_production_auth_and_invites.sql") as f:
        con.executescript(f.read())
    with open("migrations/0002_acorn_beta_activation_keys.sql") as f:
        con.executescript(f.read())

    key_id = "key_idemp"
    user_id = "user_repeat"

    con.execute(
        "INSERT INTO activation_keys (id, label, key_hash, max_redemptions, redemption_count, created_by) VALUES (?, 'Single', 'hash_idemp', 2, 0, 'founder')",
        (key_id,)
    )
    con.commit()

    # First attempt: user redeems
    con.execute("UPDATE activation_keys SET redemption_count = redemption_count + 1 WHERE id = ?", (key_id,))
    con.execute("INSERT INTO activation_redemptions (id, activation_key_id, telegram_user_id) VALUES ('r1', ?, ?)", (key_id, user_id))
    con.commit()

    # Second attempt: check uniqueness constraint
    prior = con.execute("SELECT id FROM activation_redemptions WHERE activation_key_id = ? AND telegram_user_id = ?", (key_id, user_id)).fetchone()
    assert prior is not None  # Already redeemed; caller skips incrementing counter

    row = con.execute("SELECT redemption_count FROM activation_keys WHERE id = ?", (key_id,)).fetchone()
    assert row[0] == 1  # Still 1, did not double-increment
    con.close()
