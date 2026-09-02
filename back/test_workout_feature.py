import pytest

from main import build_forecast, build_progress_series, build_session_summary, normalize_exercise_name


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
        {"id": "a1", "exercise_id": "ex-1", "log_date": "2026-01-03", "weight": 100, "reps": 5, "exercises": {"name": "Bench Press"}},
        {"id": "a2", "exercise_id": "ex-1", "log_date": "2026-01-03", "weight": 80, "reps": 8, "exercises": {"name": "Bench Press"}},
        {"id": "b1", "exercise_id": "ex-2", "log_date": "2026-01-01", "weight": 70, "reps": 10, "exercises": {"name": "Squat"}},
    ]

    result = build_session_summary(rows)

    assert result == [
        {"date": "2026-01-03", "total_volume": 1140, "entries": [
            {"log_id": "a1", "exercise_id": "ex-1", "exercise_name": "Bench Press", "weight": 100, "reps": 5, "volume": 500},
            {"log_id": "a2", "exercise_id": "ex-1", "exercise_name": "Bench Press", "weight": 80, "reps": 8, "volume": 640},
        ]},
        {"date": "2026-01-01", "total_volume": 700, "entries": [
            {"log_id": "b1", "exercise_id": "ex-2", "exercise_name": "Squat", "weight": 70, "reps": 10, "volume": 700},
        ]},
    ]


def test_build_forecast_projects_a_simple_trend():
    points = [
        {"date": "2026-01-01", "volume": 100},
        {"date": "2026-01-02", "volume": 130},
        {"date": "2026-01-03", "volume": 160},
    ]

    result = build_forecast(points, periods=2)

    assert len(result) == 2
    assert result[0]["date"] == "2026-01-04"
    assert result[0]["value"] > 0
    assert result[1]["date"] == "2026-01-05"
