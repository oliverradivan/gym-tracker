from back.services.forecast import build_forecast


def test_sharp_decline_never_forecasts_negative_values():
    points = [
        {"date": "2024-01-01", "volume": 100},
        {"date": "2024-01-08", "volume": 50},
        {"date": "2024-01-15", "volume": 20},
        {"date": "2024-01-22", "volume": 10},
        {"date": "2024-01-29", "volume": 5},
    ]

    forecast = build_forecast(points, periods=3, interval_days=7, category="compound")

    assert len(forecast) == 3
    assert all(point["value"] >= 0 for point in forecast)
