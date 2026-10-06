from back.services.forecast import build_forecast


def test_forecast_returns_empty_for_insufficient_points():
    assert build_forecast([{"date": "2024-01-01", "volume": 100}]) == []


def test_forecast_preserves_a_flat_series():
    points = [
        {"date": f"2024-01-{day:02d}", "volume": 100}
        for day in (1, 8, 15, 22)
    ]

    forecast = build_forecast(points, periods=3, interval_days=7, category="compound")

    assert [point["value"] for point in forecast] == [100, 100, 100]


def test_forecast_scales_with_the_input_volume():
    points = [
        {"date": "2024-01-01", "volume": 50},
        {"date": "2024-01-08", "volume": 55},
        {"date": "2024-01-15", "volume": 58},
        {"date": "2024-01-22", "volume": 60},
    ]

    forecast = build_forecast(points, periods=3, interval_days=7)
    scaled_forecast = build_forecast(
        [{"date": point["date"], "volume": point["volume"] * 2} for point in points],
        periods=3,
        interval_days=7,
    )

    assert all(
        abs(scaled["value"] - point["value"] * 2) < 0.02
        for scaled, point in zip(scaled_forecast, forecast)
    )
