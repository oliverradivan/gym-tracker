from back.services.forecast import (
    MAX_CONFIDENCE_BAND,
    MIN_CONFIDENCE_BAND,
    build_forecast,
    get_confidence_band_pct,
)


def test_build_forecast_projects_a_positive_trend():
    points = [
        {"date": "2024-01-01", "volume": 100},
        {"date": "2024-01-08", "volume": 110},
        {"date": "2024-01-15", "volume": 115},
        {"date": "2024-01-22", "volume": 118},
        {"date": "2024-01-29", "volume": 120},
    ]

    forecast = build_forecast(points, periods=4, interval_days=7, category="compound")

    assert len(forecast) == 4
    assert forecast[0]["date"] == "2024-02-05"
    assert all(point["value"] > 0 for point in forecast)
    assert all(
        forecast[index]["value"] > forecast[index - 1]["value"]
        for index in range(1, len(forecast))
    )


def test_build_forecast_keeps_flat_history_flat():
    points = [
        {"date": "2024-01-01", "volume": 100},
        {"date": "2024-01-08", "volume": 100},
        {"date": "2024-01-15", "volume": 100},
    ]

    forecast = build_forecast(points, periods=3, interval_days=7)

    assert [point["value"] for point in forecast] == [100, 100, 100]


def test_build_forecast_handles_history_without_increasing_intervals():
    points = [
        {"date": "2024-01-01", "volume": 100},
        {"date": "2024-01-08", "volume": 95},
        {"date": "2024-01-15", "volume": 90},
    ]

    forecast = build_forecast(points, periods=2, interval_days=7)

    assert [point["date"] for point in forecast] == ["2024-01-22", "2024-01-29"]
    assert 0 < forecast[1]["value"] < forecast[0]["value"] < 90


def test_confidence_bands_stay_within_configured_limits():
    assert get_confidence_band_pct(2) == MAX_CONFIDENCE_BAND
    assert get_confidence_band_pct(100) == MIN_CONFIDENCE_BAND
    assert get_confidence_band_pct(2, forecast_offset=100) == MAX_CONFIDENCE_BAND
    assert get_confidence_band_pct(100, forecast_offset=1) == MIN_CONFIDENCE_BAND

    forecast = build_forecast(
        [
            {"date": "2024-01-01", "volume": 100},
            {"date": "2024-01-08", "volume": 110},
            {"date": "2024-01-15", "volume": 120},
        ],
        periods=3,
        interval_days=7,
    )
    for point in forecast:
        assert point["lower"] >= 0
        assert point["lower"] >= point["value"] * (1 - MAX_CONFIDENCE_BAND) - 0.02
        assert point["upper"] <= point["value"] * (1 + MAX_CONFIDENCE_BAND) + 0.02
