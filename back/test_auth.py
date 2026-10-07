from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from back.data_access import get_auth_client
from back.dependencies import get_current_user_context
from back.main import app
from back import data_access
from back.routers import auth as auth_router

check_rate_limit = auth_router.check_rate_limit
normalize_username = auth_router.normalize_username


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
    user = SimpleNamespace(id="user-123", email="alex@example.com")

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

    database = DummySupabase()
    monkeypatch.setattr(auth_router, "get_admin_client", lambda: database)
    monkeypatch.setitem(
        app.dependency_overrides,
        get_current_user_context,
        lambda: (database, user),
    )
    monkeypatch.setattr(
        auth_router,
        "create_auth_client",
        lambda: SimpleNamespace(auth=SimpleNamespace(sign_in_with_password=lambda payload: object())),
    )

    response = TestClient(app).request(
        "DELETE",
        "/api/profile",
        json={"password": "current-password"},
        headers={"Authorization": "Bearer user-token"},
    )

    assert response.status_code == 500
    assert profile_table.restored == expected_profile

def test_check_rate_limit_blocks_excessive_auth_attempts(monkeypatch):
    calls = []

    class DummyAdminClient:
        def rpc(self, function_name, params):
            calls.append((function_name, params))
            return self

        def execute(self):
            return SimpleNamespace(data=len(calls) <= 3)

    monkeypatch.setattr(auth_router, "get_admin_client", lambda: DummyAdminClient())

    for _ in range(3):
        check_rate_limit("test-user:127.0.0.1", max_requests=3, window_seconds=60)

    with pytest.raises(HTTPException, match="Too many requests"):
        check_rate_limit("test-user:127.0.0.1", max_requests=3, window_seconds=60)

    assert len(calls) == 4
    assert calls[0] == (
        "consume_auth_rate_limit",
        {
            "p_bucket_key": "test-user:127.0.0.1",
            "p_max_requests": 3,
            "p_window_seconds": 60,
        },
    )


def test_get_auth_client_requires_supabase_env(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_ANON_KEY", raising=False)

    with pytest.raises(HTTPException, match="Supabase is not configured"):
        get_auth_client()


def test_user_context_uses_anon_key_and_caller_jwt(monkeypatch):
    token_calls = []
    client_args = []
    user = SimpleNamespace(id="user-123")

    class DummyClient:
        def __init__(self):
            self.auth = SimpleNamespace(get_user=lambda token: (token_calls.append(token) or SimpleNamespace(user=user)))
            self.postgrest = SimpleNamespace(auth=lambda token: token_calls.append(token))

    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "public-anon-key")
    monkeypatch.setattr(
        data_access,
        "create_client",
        lambda url, key: (client_args.append((url, key)) or DummyClient()),
    )

    client, authenticated_user = data_access.get_user_context("Bearer caller-jwt")

    assert client_args == [("https://example.supabase.co", "public-anon-key")]
    assert token_calls == ["caller-jwt", "caller-jwt"]
    assert authenticated_user is user
    assert client is not None


def test_update_password_uses_admin_api(monkeypatch):
    admin_updated = {}

    class DummyAdmin:
        def update_user_by_id(self, user_id, attributes):
            admin_updated[user_id] = attributes

    class DummySupabase:
        def __init__(self):
            self.auth = SimpleNamespace(admin=DummyAdmin())

    database = DummySupabase()
    monkeypatch.setattr(auth_router, "get_admin_client", lambda: database)
    monkeypatch.setitem(
        app.dependency_overrides,
        get_current_user_context,
        lambda: (database, SimpleNamespace(id="user-123", email="alex@example.com")),
    )
    monkeypatch.setattr(
        auth_router,
        "create_auth_client",
        lambda: SimpleNamespace(auth=SimpleNamespace(sign_in_with_password=lambda payload: object())),
    )

    response = TestClient(app).patch(
        "/api/profile/password",
        json={"current_password": "old", "new_password": "newpassword123"},
        headers={"Authorization": "Bearer user-token"},
    )

    assert response.status_code == 200
    assert response.json() == {"message": "Password updated successfully"}
    assert admin_updated["user-123"] == {"password": "newpassword123"}

def test_registration_rejects_password_under_ten_characters(monkeypatch):
    monkeypatch.setattr(auth_router, "get_admin_client", lambda: object())
    monkeypatch.setattr(auth_router, "check_rate_limit", lambda *_args, **_kwargs: None)

    response = TestClient(app).post(
        "/api/auth/register",
        json={"username": "alex", "email": "alex@example.com", "password": "123456789"},
    )

    assert response.status_code == 400
    assert "at least 10 characters" in response.json()["detail"]

def test_password_update_rejects_password_under_ten_characters(monkeypatch):
    user = SimpleNamespace(id="user-123", email="alex@example.com")
    monkeypatch.setitem(
        app.dependency_overrides,
        get_current_user_context,
        lambda: (object(), user),
    )

    response = TestClient(app).patch(
        "/api/profile/password",
        json={"current_password": "old", "new_password": "123456789"},
        headers={"Authorization": "Bearer user-token"},
    )

    assert response.status_code == 400
    assert "at least 10 characters" in response.json()["detail"]
