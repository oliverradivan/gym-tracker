from back.services.forecast import build_forecast


def test_declining_forecast_remains_nonnegative_and_decreases():
    points = [
        {"date": "2024-01-01", "volume": 100},
        {"date": "2024-01-08", "volume": 90},
        {"date": "2024-01-15", "volume": 80},
        {"date": "2024-01-22", "volume": 70},
        {"date": "2024-01-29", "volume": 60},
    ]

    forecast = build_forecast(points, periods=3, interval_days=7, category="compound")

    assert len(forecast) == 3
    assert all(point["value"] >= 0 for point in forecast)
    assert all(
        forecast[index]["value"] < forecast[index - 1]["value"]
        for index in range(1, len(forecast))
    )
