import sys
sys.path.insert(0, '.')
from main import build_forecast

points = [
    {"date": "2024-01-01", "volume": 100},
    {"date": "2024-01-08", "volume": 110},
    {"date": "2024-01-15", "volume": 115},
    {"date": "2024-01-22", "volume": 118},
    {"date": "2024-01-29", "volume": 120},
]
forecast = build_forecast(points, periods=4, interval_days=7, category="compound")
print("Forecast:")
for f in forecast:
    print(f)
