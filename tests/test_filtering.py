"""
Unit Tests: Role-Title Token Alignment & False-Positive Suppression
"""

import pytest
from src.acorn.domain.filtering import is_relevant_title


def test_core_tech_title_accepted():
    assert is_relevant_title("Junior Software Engineer") is True
    assert is_relevant_title("IT Support Specialist") is True
    assert is_relevant_title("Help Desk Technician Tier 1") is True
    assert is_relevant_title("Cloud Application Developer") is True
    assert is_relevant_title("Junior Java Developer") is True


def test_senior_title_blocked_without_override():
    assert is_relevant_title("Senior Software Engineer") is False
    assert is_relevant_title("Staff DevOps Engineer") is False
    assert is_relevant_title("Principal Architect") is False
    assert is_relevant_title("IT Director") is False
    assert is_relevant_title("Engineering Manager") is False


def test_junior_override_on_senior_title_accepted():
    assert is_relevant_title("Junior Software Engineer - Manager Assistant") is True
    assert is_relevant_title("IT Lead - Intern") is True
    assert is_relevant_title("Entry-level Architect Trainee") is True


def test_non_tech_false_positives_blocked():
    assert is_relevant_title("Sales Representative") is False
    assert is_relevant_title("Warehouse Associate") is False
    assert is_relevant_title("Delivery Driver") is False
    assert is_relevant_title("Cashier / Store Associate") is False
    assert is_relevant_title("Forklift Operator") is False
    assert is_relevant_title("Security Guard") is False


def test_custom_user_role_alignment():
    user_roles = ["Site Reliability Engineer", "Database Specialist"]
    assert is_relevant_title("Site Reliability Engineer - Entry", user_roles=user_roles) is True
    assert is_relevant_title("Associate Database Specialist", user_roles=user_roles) is True
