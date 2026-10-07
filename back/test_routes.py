from copy import deepcopy
from types import SimpleNamespace

from fastapi.testclient import TestClient

from back.dependencies import get_current_user_context
from back.main import app


client = TestClient(app)


class FakeTable:
    def __init__(self, database, table_name):
        self.database = database
        self.table_name = table_name
        self.filters = []
        self.insert_values = None
        self.selection = None
        self.operation = "select"

    def select(self, columns):
        self.selection = columns
        return self

    def eq(self, key, value):
        self.filters.append((key, value))
        return self

    def order(self, *_args, **_kwargs):
        return self

    def limit(self, *_args):
        return self

    def insert(self, values):
        self.insert_values = values
        self.operation = "insert"
        return self

    def delete(self):
        self.operation = "delete"
        return self

    def execute(self):
        self.database.queries.append((self.table_name, list(self.filters)))
        if self.table_name == "exercises":
            matches = [
                row for row in self.database.exercises
                if all(row.get(key) == value for key, value in self.filters)
            ]
            return SimpleNamespace(data=deepcopy(matches))

        if self.operation == "insert":
            row = {
                **self.insert_values,
                "id": "log-created",
                "created_at": "2026-10-06T10:00:00+00:00",
            }
            self.database.logs.append(row)
            return SimpleNamespace(data=[deepcopy(row)])

        matches = [
            row for row in self.database.logs
            if all(row.get(key) == value for key, value in self.filters)
        ]
        if self.operation == "delete":
            self.database.logs = [
                row for row in self.database.logs if row not in matches
            ]
        return SimpleNamespace(data=deepcopy(matches))


class FakeSupabase:
    def __init__(self):
        self.exercises = [{"id": "exercise-1", "name": "Bench Press", "category": "Push"}]
        self.logs = [
            {
                "id": "other-user-log",
                "user_id": "user-2",
                "exercise_id": "exercise-1",
                "log_date": "2026-10-05",
                "weight": 40,
                "reps": 8,
                "set_number": 1,
                "created_at": "2026-10-05T10:00:00+00:00",
            }
        ]
        self.queries = []

    def table(self, table_name):
        return FakeTable(self, table_name)


def test_workout_logs_requires_authentication():
    response = client.get("/api/workout-logs")

    assert response.status_code == 401
    assert response.json()["detail"] == "Missing or invalid bearer token."


def test_workout_create_and_read_are_scoped_to_authenticated_user(monkeypatch):
    database = FakeSupabase()
    monkeypatch.setitem(
        app.dependency_overrides,
        get_current_user_context,
        lambda: (database, SimpleNamespace(id="user-1")),
    )

    create_response = client.post(
        "/api/workout-logs",
        headers={"Authorization": "Bearer test-token"},
        json={
            "exercise_id": "exercise-1",
            "log_date": "2026-10-06",
            "weight": 60,
            "reps": 8,
        },
    )

    assert create_response.status_code == 200
    created_log = create_response.json()["log"]
    assert created_log["user_id"] == "user-1"
    assert created_log["set_number"] == 1

    read_response = client.get(
        "/api/workout-logs",
        headers={"Authorization": "Bearer test-token"},
    )

    assert read_response.status_code == 200
    logs = read_response.json()["logs"]
    assert [log["id"] for log in logs] == ["log-created"]
    assert all(log["user_id"] == "user-1" for log in logs)
    assert ("workout_logs", [("user_id", "user-1")]) in database.queries


def test_user_cannot_read_or_delete_another_users_workout(monkeypatch):
    database = FakeSupabase()
    monkeypatch.setitem(
        app.dependency_overrides,
        get_current_user_context,
        lambda: (database, SimpleNamespace(id="user-1")),
    )

    read_response = client.get(
        "/api/workout-logs",
        headers={"Authorization": "Bearer user-a-token"},
    )
    delete_response = client.delete(
        "/api/workout-logs/other-user-log",
        headers={"Authorization": "Bearer user-a-token"},
    )

    assert read_response.status_code == 200
    assert read_response.json()["logs"] == []
    assert delete_response.status_code == 404
    assert [row["id"] for row in database.logs] == ["other-user-log"]
