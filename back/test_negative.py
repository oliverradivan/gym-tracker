from main import build_forecast

# Simulating decreasing volume
points = [
    {"date": "2024-01-01", "volume": 100},
    {"date": "2024-01-08", "volume": 90},
    {"date": "2024-01-15", "volume": 80},
    {"date": "2024-01-22", "volume": 70},
    {"date": "2024-01-29", "volume": 60},
]
forecast = build_forecast(points, periods=3, interval_days=7, category="compound")
print("Forecast:")
for f in forecast:
    print(f)
    if f["value"] < 0:
        print("NEGATIVE VALUE DETECTED!")
