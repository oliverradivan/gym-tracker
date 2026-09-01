from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from main import RATE_LIMIT_BUCKETS, DeleteAccountPayload, check_rate_limit, delete_account, normalize_username


class DummyProfileTable:
    def __init__(self, profile=None):
        self.profile = profile
        self.deleted = False
        self.restored = None
        self._select_mode = True

    def select(self, *args, **kwargs):
        return self

    def delete(self):
        self.deleted = True
        return self

    def eq(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    def execute(self):
        if self._select_mode:
            self._select_mode = False
            return SimpleNamespace(data=[self.profile] if self.profile else [])
        return SimpleNamespace(data=[])

    def upsert(self, row, on_conflict=None):
        self.restored = row
        return self


def test_normalize_username_strips_and_lowercases():
    assert normalize_username("  Alex Smith  ") == "alexsmith"


def test_normalize_username_strips_non_alphanumeric():
    assert normalize_username("alex_smith-99!") == "alexsmith99"


def test_normalize_username_too_short_raises():
    with pytest.raises(ValueError):
        normalize_username("ab")


def test_normalize_username_too_long_raises():
    with pytest.raises(ValueError):
        normalize_username("a" * 25)


def test_normalize_username_empty_raises():
    with pytest.raises(ValueError):
        normalize_username("   ")


def test_delete_account_restores_profile_when_auth_delete_fails(monkeypatch):
    expected_profile = {"id": "user-123", "username": "alex", "email": "alex@example.com"}
    profile_table = DummyProfileTable(expected_profile)

    class DummyAuthAdmin:
        def delete_user(self, user_id):
            raise RuntimeError("delete-user-failed")

    class DummySupabase:
        def __init__(self):
            self.auth = SimpleNamespace(admin=DummyAuthAdmin())
            self._profile_table = profile_table

        def table(self, name):
            if name == "profiles":
                return self._profile_table
            raise AssertionError(f"Unexpected table: {name}")

    monkeypatch.setattr("main.supabase", DummySupabase())
    monkeypatch.setattr(
        "main.get_authenticated_user",
        lambda authorization: SimpleNamespace(
            id="user-123",
            email="alex@example.com",
            session=SimpleNamespace(access_token="abc"),
        ),
    )
    monkeypatch.setattr(
        "main.get_auth_client",
        lambda: SimpleNamespace(auth=SimpleNamespace(sign_in_with_password=lambda payload: object())),
    )

    with pytest.raises(HTTPException, match="Failed to delete account|restored"):
        delete_account(DeleteAccountPayload(password="secret"), authorization="Bearer token")

    assert profile_table.restored == expected_profile


def test_check_rate_limit_blocks_excessive_auth_attempts():
    RATE_LIMIT_BUCKETS.clear()

    for _ in range(3):
        check_rate_limit("test-user:127.0.0.1", max_requests=3, window_seconds=60)

    with pytest.raises(HTTPException, match="Too many requests"):
        check_rate_limit("test-user:127.0.0.1", max_requests=3, window_seconds=60)