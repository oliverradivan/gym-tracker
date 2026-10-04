import pytest
from types import SimpleNamespace

import main

from main import (
    WorkoutLogPayload,
    build_forecast,
    build_progress_series,
    build_session_summary,
    get_exercise_category,
    normalize_exercise_name,
    validate_workout_log_payload,
)


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
        {"id": "a1", "exercise_id": "ex-1", "log_date": "2026-01-03", "weight": 100, "reps": 5.5, "exercises": {"name": "Bench Press"}},
        {"id": "a2", "exercise_id": "ex-1", "log_date": "2026-01-03", "weight": 80, "reps": 8, "exercises": {"name": "Bench Press"}},
        {"id": "b1", "exercise_id": "ex-2", "log_date": "2026-01-01", "weight": 70, "reps": 10, "exercises": {"name": "Squat"}},
    ]

    result = build_session_summary(rows)

    assert result == [
        {"date": "2026-01-03", "total_volume": 1190, "entries": [
            {"log_id": "a1", "exercise_id": "ex-1", "exercise_name": "Bench Press", "weight": 100, "reps": 5.5, "volume": 550, "duration_seconds": None},
            {"log_id": "a2", "exercise_id": "ex-1", "exercise_name": "Bench Press", "weight": 80, "reps": 8, "volume": 640, "duration_seconds": None},
        ]},
        {"date": "2026-01-01", "total_volume": 700, "entries": [
            {"log_id": "b1", "exercise_id": "ex-2", "exercise_name": "Squat", "weight": 70, "reps": 10, "volume": 700, "duration_seconds": None},
        ]},
    ]


def test_cardio_category_precedes_strength_matching_and_fallback_remains():
    assert get_exercise_category("Incline Treadmill Walk") == "cardio"
    assert get_exercise_category("Rowing Machine") == "cardio"
    assert get_exercise_category("Bench Press") == "push"
    assert get_exercise_category("Crunches") == "leg"
    assert get_exercise_category("Plank") == "cardio"


def test_cardio_payload_requires_duration_and_rejects_weight_or_reps():
    validate_workout_log_payload(
        WorkoutLogPayload(exercise_id="ex-cardio", log_date="2026-01-01", duration_seconds=1930),
        "Treadmill",
    )

    with pytest.raises(ValueError, match="Duration"):
        validate_workout_log_payload(
            WorkoutLogPayload(exercise_id="ex-cardio", log_date="2026-01-01", duration_seconds=0),
            "Treadmill",
        )

    with pytest.raises(ValueError, match="Weight and reps"):
        validate_workout_log_payload(
            WorkoutLogPayload(exercise_id="ex-cardio", log_date="2026-01-01", weight=10, duration_seconds=1930),
            "Treadmill",
        )


def test_non_cardio_payload_requires_weight_reps_and_rejects_duration():
    validate_workout_log_payload(
        WorkoutLogPayload(exercise_id="ex-strength", log_date="2026-01-01", weight=50, reps=8),
        "Bench Press",
    )

    with pytest.raises(ValueError, match="Weight is required"):
        validate_workout_log_payload(
            WorkoutLogPayload(exercise_id="ex-strength", log_date="2026-01-01", reps=8),
            "Bench Press",
        )

    with pytest.raises(ValueError, match="only accepted for cardio"):
        validate_workout_log_payload(
            WorkoutLogPayload(exercise_id="ex-strength", log_date="2026-01-01", weight=50, reps=8, duration_seconds=30),
            "Bench Press",
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
            "exercises": {"name": "Treadmill"},
        },
        {
            "id": "strength-1",
            "exercise_id": "ex-strength",
            "log_date": "2026-01-01",
            "weight": 50,
            "reps": 8,
            "duration_seconds": None,
            "exercises": {"name": "Bench Press"},
        },
    ])

    assert result == [{
        "date": "2026-01-01",
        "total_volume": 400,
        "entries": [
            {
                "log_id": "cardio-1",
                "exercise_id": "ex-cardio",
                "exercise_name": "Treadmill",
                "weight": None,
                "reps": None,
                "volume": 0,
                "duration_seconds": 1930,
            },
            {
                "log_id": "strength-1",
                "exercise_id": "ex-strength",
                "exercise_name": "Bench Press",
                "weight": 50,
                "reps": 8,
                "volume": 400,
                "duration_seconds": None,
            },
        ],
    }]


@pytest.mark.parametrize(
    ("exercise_name", "payload_data", "expected_values"),
    [
        (
            "Treadmill",
            {"duration_seconds": 1930},
            {"weight": None, "reps": None, "duration_seconds": 1930},
        ),
        (
            "Bench Press",
            {"weight": 50, "reps": 8},
            {"weight": 50, "reps": 8, "duration_seconds": None},
        ),
    ],
)
def test_create_workout_log_inserts_type_specific_values(
    monkeypatch, exercise_name, payload_data, expected_values
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

        def insert(self, values):
            self.insert_data = values
            return self

        def execute(self):
            if self.table_name == "exercises":
                return SimpleNamespace(data=[{"id": "exercise-id", "name": exercise_name}])
            return SimpleNamespace(data=[self.insert_data])

    class FakeSupabase:
        def table(self, table_name):
            return FakeTable(table_name)

    monkeypatch.setattr(main, "supabase", FakeSupabase())
    monkeypatch.setattr(main, "get_authenticated_user", lambda _authorization: SimpleNamespace(id="user-id"))
    payload = WorkoutLogPayload(
        exercise_id="exercise-id",
        log_date="2026-01-01",
        **payload_data,
    )

    result = main.create_workout_log(payload, authorization="Bearer test-token")

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
