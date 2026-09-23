from main import build_forecast

# Test case that previously produced negative values
points = [
    {"date": "2024-01-01", "volume": 100},
    {"date": "2024-01-08", "volume": 50},
    {"date": "2024-01-15", "volume": 20},
    {"date": "2024-01-22", "volume": 10},
    {"date": "2024-01-29", "volume": 5},
]
forecast = build_forecast(points, periods=3, interval_days=7, category="compound")
print("Forecast after fix:")
all_ok = True
for f in forecast:
    print(f)
    if f["value"] < 0:
        print("ERROR: negative value")
        all_ok = False
    if f["lower"] > f["upper"]:
        print("ERROR: lower > upper")
        all_ok = False
    if f["lower"] < 0:
        print("ERROR: lower negative")
        all_ok = False
if all_ok:
    print("All checks passed.")
