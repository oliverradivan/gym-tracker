import pytest
from types import SimpleNamespace

from back.exercise_categories import (
    CARDIO_CATEGORY,
    EXERCISE_CATEGORIES,
    LEG_CATEGORY,
    OTHER_CATEGORY,
    PUSH_CATEGORY,
    normalize_exercise_category,
)
from back.routers import exercises, sessions, workouts
from back.schemas import ExercisePayload, WorkoutLogPayload
from back.services.forecast import build_forecast

build_progress_series = sessions.build_progress_series
build_session_summary = sessions.build_session_summary
normalize_exercise_name = exercises.normalize_exercise_name
serialize_exercise = exercises.serialize_exercise
validate_workout_log_payload = exercises.validate_workout_log_payload


def test_normalize_exercise_name_trims_and_cleans():
    assert normalize_exercise_name("  Bench Press  ") == "Bench Press"
    assert normalize_exercise_name("bench_press") == "bench press"
    assert normalize_exercise_name("  squat   - 5  ") == "squat 5"


def test_build_progress_series_groups_by_date_and_calculates_volume():
    rows = [
        {"log_date": "2026-01-01", "weight": 100, "reps": 5},
        {"log_date": "2026-01-01", "weight": 80, "reps": 8},
        {"log_date": "2026-01-03", "weight": 110, "reps": 6},
    ]

    result = build_progress_series(rows)

    assert result == [
        {"date": "2026-01-01", "volume": 1140, "reps": 13, "weight": 180},
        {"date": "2026-01-03", "volume": 660, "reps": 6, "weight": 110},
    ]


def test_normalize_exercise_name_rejects_empty_value():
    with pytest.raises(ValueError):
        normalize_exercise_name("   ")


def test_build_session_summary_groups_by_date_and_sums_volume():
    rows = [
        {"id": "a1", "exercise_id": "ex-1", "log_date": "2026-01-03", "weight": 100, "reps": 5.5, "exercises": {"name": "Bench Press", "category": "Push"}},
        {"id": "a2", "exercise_id": "ex-1", "log_date": "2026-01-03", "weight": 80, "reps": 8, "exercises": {"name": "Bench Press", "category": "Push"}},
        {"id": "b1", "exercise_id": "ex-2", "log_date": "2026-01-01", "weight": 70, "reps": 10, "exercises": {"name": "Squat", "category": "Leg"}},
    ]

    result = build_session_summary(rows)

    assert result == [
        {"date": "2026-01-03", "total_volume": 1190, "entries": [
            {"log_id": "a1", "exercise_id": "ex-1", "exercise_name": "Bench Press", "exercise_category": "Push", "weight": 100, "reps": 5.5, "volume": 550, "duration_seconds": None},
            {"log_id": "a2", "exercise_id": "ex-1", "exercise_name": "Bench Press", "exercise_category": "Push", "weight": 80, "reps": 8, "volume": 640, "duration_seconds": None},
        ]},
        {"date": "2026-01-01", "total_volume": 700, "entries": [
            {"log_id": "b1", "exercise_id": "ex-2", "exercise_name": "Squat", "exercise_category": "Leg", "weight": 70, "reps": 10, "volume": 700, "duration_seconds": None},
        ]},
    ]


def test_database_category_normalization_uses_allowed_casing_and_fallback():
    assert EXERCISE_CATEGORIES == ("Push", "Pull", "Leg", "Cardio", "Other")
    assert normalize_exercise_category("cArDiO") == CARDIO_CATEGORY
    assert normalize_exercise_category("push") == PUSH_CATEGORY
    assert normalize_exercise_category("Leg") == LEG_CATEGORY
    assert normalize_exercise_category(None) == OTHER_CATEGORY
    assert normalize_exercise_category("Unknown") == OTHER_CATEGORY


def test_custom_exercise_payload_defaults_and_validates_category():
    assert ExercisePayload(name="Custom movement").category == OTHER_CATEGORY
    for category in EXERCISE_CATEGORIES:
        assert ExercisePayload(name="Custom movement", category=category).category == category
    with pytest.raises(ValueError, match="Category must be one of"):
        ExercisePayload(name="Custom movement", category="other")


def test_create_exercise_saves_selected_canonical_category(monkeypatch):
    class FakeTable:
        def __init__(self):
            self.insert_data = None

        def select(self, *_args):
            return self

        def execute(self):
            if self.insert_data is None:
                return SimpleNamespace(data=[])
            return SimpleNamespace(data=[{"id": "ex-custom", **self.insert_data}])

        def insert(self, values):
            self.insert_data = values
            return self

    class FakeSupabase:
        def __init__(self):
            self.exercise_table = FakeTable()

        def table(self, _table_name):
            return self.exercise_table

    database = FakeSupabase()
    monkeypatch.setattr(exercises, "get_supabase", lambda: database)
    monkeypatch.setattr(
        exercises,
        "get_authenticated_user",
        lambda _authorization: SimpleNamespace(id="user-1"),
    )

    result = exercises.create_exercise(
        ExercisePayload(name="Custom movement", category="Cardio"),
        authorization=None,
    )

    assert database.exercise_table.insert_data["category"] == "Cardio"
    assert result["exercise"]["category"] == "Cardio"
    assert result["exercise"]["exercise_category"] == "Cardio"


def test_serialize_exercise_adds_category_without_replacing_database_category():
    assert serialize_exercise({"name": "Plank", "category": "Leg"}) == {
        "name": "Plank",
        "category": "Leg",
        "exercise_category": "Leg",
    }
    assert serialize_exercise({"name": "Treadmill", "category": "other"})[
        "exercise_category"
    ] == OTHER_CATEGORY


def test_list_exercises_returns_the_backend_classification(monkeypatch):
    class FakeTable:
        def select(self, *_args):
            return self

        def or_(self, *_args):
            return self

        def order(self, *_args):
            return self

        def execute(self):
            return SimpleNamespace(data=[{"id": "ex-1", "name": "Plank", "category": "Leg"}])

    class FakeSupabase:
        def table(self, _table_name):
            return FakeTable()

    monkeypatch.setattr(exercises, "get_supabase", lambda: FakeSupabase())
    monkeypatch.setattr(exercises, "get_authenticated_user", lambda _authorization: SimpleNamespace(id="user-1"))
    result = exercises.list_exercises(authorization=None)

    assert result["exercises"] == [
        {
            "id": "ex-1",
            "name": "Plank",
            "category": "Leg",
            "exercise_category": "Leg",
        }
    ]


def test_cardio_payload_requires_duration_and_rejects_weight_or_reps():
    validate_workout_log_payload(
        WorkoutLogPayload(exercise_id="ex-cardio", log_date="2026-01-01", duration_seconds=1930),
        "Cardio",
    )

    with pytest.raises(ValueError, match="Duration"):
        validate_workout_log_payload(
            WorkoutLogPayload(exercise_id="ex-cardio", log_date="2026-01-01", duration_seconds=0),
            "Cardio",
        )

    with pytest.raises(ValueError, match="Weight and reps"):
        validate_workout_log_payload(
            WorkoutLogPayload(exercise_id="ex-cardio", log_date="2026-01-01", weight=10, duration_seconds=1930),
            "Cardio",
        )


def test_non_cardio_payload_requires_weight_reps_and_rejects_duration():
    validate_workout_log_payload(
        WorkoutLogPayload(exercise_id="ex-strength", log_date="2026-01-01", weight=50, reps=8),
        "Push",
    )

    with pytest.raises(ValueError, match="Weight is required"):
        validate_workout_log_payload(
            WorkoutLogPayload(exercise_id="ex-strength", log_date="2026-01-01", reps=8),
            "Push",
        )

    with pytest.raises(ValueError, match="only accepted for cardio"):
        validate_workout_log_payload(
            WorkoutLogPayload(exercise_id="ex-strength", log_date="2026-01-01", weight=50, reps=8, duration_seconds=30),
            "Push",
        )


def test_cardio_progress_keeps_time_points_and_ignores_legacy_rows_without_duration():
    rows = [
        {"log_date": "2026-01-01", "duration_seconds": 1930, "weight": 20, "reps": 10},
        {"log_date": "2026-01-02", "duration_seconds": None, "weight": 20, "reps": 10},
    ]

    assert build_progress_series(rows, is_cardio=True) == [
        {"date": "2026-01-01", "duration_seconds": 1930},
    ]


def test_cardio_session_entries_are_excluded_from_volume_and_keep_legacy_rows():
    result = build_session_summary([
        {
            "id": "cardio-1",
            "exercise_id": "ex-cardio",
            "log_date": "2026-01-01",
            "weight": 20,
            "reps": 10,
            "duration_seconds": 1930,
            "exercises": {            "name": "Morning movement", "category": "Cardio"},
        },
        {
            "id": "strength-1",
            "exercise_id": "ex-strength",
            "log_date": "2026-01-01",
            "weight": 50,
            "reps": 8,
            "duration_seconds": None,
            "exercises": {"name": "Bench Press", "category": "Push"},
        },
    ])

    assert result == [{
        "date": "2026-01-01",
        "total_volume": 400,
        "entries": [
            {
                "log_id": "cardio-1",
                "exercise_id": "ex-cardio",
                "exercise_name": "Morning movement",
                "exercise_category": "Cardio",
                "weight": None,
                "reps": None,
                "volume": 0,
                "duration_seconds": 1930,
            },
            {
                "log_id": "strength-1",
                "exercise_id": "ex-strength",
                "exercise_name": "Bench Press",
                "exercise_category": "Push",
                "weight": 50,
                "reps": 8,
                "volume": 400,
                "duration_seconds": None,
            },
        ],
    }]


def test_workout_sessions_select_category_and_return_normalized_exercise_category(monkeypatch):
    class FakeTable:
        selected = None

        def select(self, columns):
            self.selected = columns
            return self

        def eq(self, *_args):
            return self

        def order(self, *_args, **_kwargs):
            return self

        def execute(self):
            return SimpleNamespace(data=[{
                "id": "log-1",
                "exercise_id": "exercise-1",
                "log_date": "2026-10-06",
                "weight": 50,
                "reps": 8,
                "duration_seconds": None,
                "exercises": {"name": "Bench Press", "category": "push"},
            }])

    table = FakeTable()

    class FakeSupabase:
        def table(self, _table_name):
            return table

    monkeypatch.setattr(sessions, "get_supabase", lambda: FakeSupabase())
    monkeypatch.setattr(
        sessions, "get_authenticated_user", lambda _authorization: SimpleNamespace(id="user-1")
    )

    result = sessions.get_workout_sessions(authorization=None)

    assert "exercises(name, category)" in table.selected
    assert result["sessions"][0]["entries"][0]["exercise_category"] == "Push"


@pytest.mark.parametrize(
    ("exercise_category", "payload_data", "expected_values"),
    [
        (
            "Cardio",
            {"duration_seconds": 1930},
            {"weight": None, "reps": None, "duration_seconds": 1930},
        ),
        (
            "Push",
            {"weight": 50, "reps": 8},
            {"weight": 50, "reps": 8, "duration_seconds": None},
        ),
    ],
)
def test_create_workout_log_inserts_type_specific_values(
    monkeypatch, exercise_category, payload_data, expected_values
):
    class FakeTable:
        def __init__(self, table_name):
            self.table_name = table_name
            self.insert_data = None

        def select(self, *_args):
            return self

        def eq(self, *_args):
            return self

        def limit(self, *_args):
            return self

        def order(self, *_args, **_kwargs):
            return self

        def insert(self, values):
            self.insert_data = values
            return self

        def execute(self):
            if self.table_name == "exercises":
                return SimpleNamespace(data=[{"id": "exercise-id", "category": exercise_category}])
            return SimpleNamespace(data=[self.insert_data] if self.insert_data else [])

    class FakeSupabase:
        def table(self, table_name):
            return FakeTable(table_name)

    monkeypatch.setattr(workouts, "get_supabase", lambda: FakeSupabase())
    monkeypatch.setattr(workouts, "get_authenticated_user", lambda _authorization: SimpleNamespace(id="user-id"))
    payload = WorkoutLogPayload(
        exercise_id="exercise-id",
        log_date="2026-01-01",
        **payload_data,
    )
    result = workouts.create_workout_log(payload, authorization=None)

    assert {key: result["log"][key] for key in expected_values} == expected_values


def test_build_forecast_projects_a_simple_trend():
    points = [
        {"date": "2026-01-01", "volume": 100},
        {"date": "2026-01-02", "volume": 130},
        {"date": "2026-01-03", "volume": 160},
    ]

    result = build_forecast(points, periods=2, interval_days=7)

    assert len(result) == 2
    assert result[0]["date"] == "2026-01-10"
    assert result[0]["value"] > 0
    assert result[1]["date"] == "2026-01-17"


def test_build_forecast_avoids_overreacting_to_a_single_big_jump():
    points = [
        {"date": "2026-01-01", "volume": 100},
        {"date": "2026-01-02", "volume": 100},
        {"date": "2026-01-03", "volume": 100},
        {"date": "2026-01-04", "volume": 160},
    ]

    result = build_forecast(points, periods=2)

    assert result[0]["value"] <= 175
    assert result[1]["value"] <= 190
