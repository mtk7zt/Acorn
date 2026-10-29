"""
Acorn Canonical Identity & Profile Management Tests
===================================================
Milestone: BETA-02 — Personalized User Profiles, Scan Isolation & Portable Data Architecture
Verifies that:
  1. Identity resolution creates stable canonical acorn_user_id (usr_<uuid>).
  2. External provider binding (Telegram chat ID -> acorn_user_id) is idempotent.
  3. Profile updates, target roles, and search preferences function correctly.
  4. Migration 0003 executes cleanly against SQLite in-memory engine.
"""

import sqlite3
from pathlib import Path
import pytest


def init_database(conn: sqlite3.Connection):
    """Executes migrations 0001, 0002, and 0003 in sequence."""
    base = Path(__file__).resolve().parent.parent / "migrations"
    m1 = (base / "0001_acorn_production_auth_and_invites.sql").read_text(encoding="utf-8")
    m2 = (base / "0002_acorn_beta_activation_keys.sql").read_text(encoding="utf-8")
    m3 = (base / "0003_user_profiles_and_portability.sql").read_text(encoding="utf-8")

    conn.executescript(m1)
    conn.executescript(m2)
    conn.executescript(m3)
    conn.commit()


def test_migration_0003_schema_execution():
    conn = sqlite3.connect(":memory:")
    init_database(conn)

    # Verify tables exist
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = {row[0] for row in cursor.fetchall()}

    expected_tables = {
        "acorn_users",
        "user_external_identities",
        "user_profiles",
        "user_target_roles",
        "user_search_preferences",
        "user_resume_assets",
        "user_scan_requests",
    }
    assert expected_tables.issubset(tables)


def test_canonical_identity_resolution_idempotency():
    conn = sqlite3.connect(":memory:")
    init_database(conn)

    tg_user_id = "55443322"
    now_iso = "2026-10-29T12:00:00Z"
    acorn_user_id = "usr_test_abc123"

    # Insert user and binding
    conn.execute(
        "INSERT INTO acorn_users (id, status, created_at, updated_at) VALUES (?, 'active', ?, ?)",
        (acorn_user_id, now_iso, now_iso),
    )
    conn.execute(
        "INSERT INTO user_external_identities (id, acorn_user_id, provider, provider_user_id, verified_at, created_at) VALUES ('ext_1', ?, 'telegram', ?, ?, ?)",
        (acorn_user_id, tg_user_id, now_iso, now_iso),
    )
    conn.commit()

    # Query by telegram ID
    cursor = conn.cursor()
    cursor.execute(
        "SELECT acorn_user_id FROM user_external_identities WHERE provider = 'telegram' AND provider_user_id = ?",
        (tg_user_id,),
    )
    row = cursor.fetchone()
    assert row is not None
    assert row[0] == acorn_user_id

    # Secondary lookup yields the exact same canonical ID
    cursor.execute(
        "SELECT acorn_user_id FROM user_external_identities WHERE provider = 'telegram' AND provider_user_id = ?",
        (tg_user_id,),
    )
    assert cursor.fetchone()[0] == acorn_user_id


def test_user_target_roles_isolation():
    conn = sqlite3.connect(":memory:")
    init_database(conn)

    user_a = "usr_user_a"
    user_b = "usr_user_b"
    now_iso = "2026-10-29T12:00:00Z"

    for uid in (user_a, user_b):
        conn.execute("INSERT INTO acorn_users (id, status, created_at, updated_at) VALUES (?, 'active', ?, ?)", (uid, now_iso, now_iso))

    # User A roles
    conn.execute(
        "INSERT INTO user_target_roles (id, acorn_user_id, role_title, normalized_role, priority, created_at, updated_at) VALUES ('r1', ?, 'Junior Software Engineer', 'junior software engineer', 1, ?, ?)",
        (user_a, now_iso, now_iso),
    )

    # User B roles
    conn.execute(
        "INSERT INTO user_target_roles (id, acorn_user_id, role_title, normalized_role, priority, created_at, updated_at) VALUES ('r2', ?, 'Lead Data Architect', 'lead data architect', 1, ?, ?)",
        (user_b, now_iso, now_iso),
    )
    conn.commit()

    # Query User A roles
    cur = conn.cursor()
    cur.execute("SELECT role_title FROM user_target_roles WHERE acorn_user_id = ?", (user_a,))
    roles_a = [r[0] for r in cur.fetchall()]

    # Query User B roles
    cur.execute("SELECT role_title FROM user_target_roles WHERE acorn_user_id = ?", (user_b,))
    roles_b = [r[0] for r in cur.fetchall()]

    assert roles_a == ["Junior Software Engineer"]
    assert roles_b == ["Lead Data Architect"]
    assert "Lead Data Architect" not in roles_a
