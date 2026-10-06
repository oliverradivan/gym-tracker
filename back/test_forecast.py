from back.services.forecast import build_forecast


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
