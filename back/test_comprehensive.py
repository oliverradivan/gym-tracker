import sys
sys.path.insert(0, '.')
from main import build_forecast

print("Test 1: insufficient points (<2)")
pts = [{"date": "2024-01-01", "volume": 100}]
res = build_forecast(pts)
print("Result:", res)
assert res == []

print("\nTest 2: exactly 2 points")
pts = [
    {"date": "2024-01-01", "volume": 100},
    {"date": "2024-01-08", "volume": 110},
]
res = build_forecast(pts, periods=3, interval_days=7, category="compound")
print("Result length:", len(res))
for f in res:
    print(f)
assert len(res) == 3
assert res[0]["value"] > 110

print("\nTest 3: established flat series -> no forced growth")
pts = [
    {"date": "2024-01-01", "volume": 100},
    {"date": "2024-01-08", "volume": 100},
    {"date": "2024-01-15", "volume": 100},
    {"date": "2024-01-22", "volume": 100},
]
res = build_forecast(pts, periods=3, interval_days=7, category="compound")
print("Result:")
for f in res:
    print(f)
assert all(point["value"] == 100 for point in res)

print("\nTest 3a: declining history is sorted and remains non-increasing")
declining_history = [
    {"date": "2024-01-22", "volume": 85},
    {"date": "2024-01-01", "volume": 100},
    {"date": "2024-01-15", "volume": 90},
    {"date": "2024-01-08", "volume": 95},
]
declining_forecast = build_forecast(declining_history, periods=3, interval_days=7)
assert all(point["value"] < 85 for point in declining_forecast)
assert all(
    declining_forecast[index]["value"] < declining_forecast[index - 1]["value"]
    for index in range(1, len(declining_forecast))
)

print("\nTest 3b: progression rate accounts for time between workouts")
weekly_history = [
    {"date": "2024-01-01", "volume": 100},
    {"date": "2024-01-08", "volume": 104},
]
monthly_history = [
    {"date": "2024-01-01", "volume": 100},
    {"date": "2024-01-29", "volume": 104},
]
weekly_forecast = build_forecast(weekly_history, periods=1, interval_days=7)
monthly_forecast = build_forecast(monthly_history, periods=1, interval_days=7)
assert weekly_forecast[0]["value"] > monthly_forecast[0]["value"]

print("\nTest 3c: research baseline follows observed progression interval")
single_progression = [
    {"date": "2024-01-01", "volume": 100},
    {"date": "2024-01-08", "volume": 104},
]
twice_scaled_progression = [
    {"date": point["date"], "volume": point["volume"] * 2}
    for point in single_progression
]
single_prediction = build_forecast(single_progression, periods=1, interval_days=7)
scaled_prediction = build_forecast(twice_scaled_progression, periods=1, interval_days=7)
assert 102 < single_prediction[0]["value"] < 110
assert abs(scaled_prediction[0]["value"] - single_prediction[0]["value"] * 2) < 0.1

print("\nTest 4: progressing history tapers over forecast steps")
pts = [
    {"date": "2024-01-01", "volume": 50},
    {"date": "2024-01-08", "volume": 55},
    {"date": "2024-01-15", "volume": 58},
    {"date": "2024-01-22", "volume": 60},
    {"date": "2024-01-29", "volume": 61},
]
res_c = build_forecast(pts, periods=4, interval_days=7, category="compound")
print("Compound forecast:")
for f in res_c:
    print(f["value"], end=" ")
print()
compound_values = [point["value"] for point in res_c]
compound_gains = [
    compound_values[index] - compound_values[index - 1]
    for index in range(1, len(compound_values))
]
assert all(gain > 0 for gain in compound_gains)
assert all(compound_gains[index] < compound_gains[index - 1] for index in range(1, len(compound_gains)))
# Isolation should have smaller increments due to lower saturation? Actually saturation lower -> diminishing returns stronger -> smaller increments later.
# Let's just ensure both produce numbers.

print("\nTest 5: increasing trend with noise")
pts = [
    {"date": "2024-01-01", "volume": 100.0},
    {"date": "2024-01-08", "volume": 102.3},
    {"date": "2024-01-15", "volume": 101.7},
    {"date": "2024-01-22", "volume": 103.5},
    {"date": "2024-01-29", "volume": 104.1},
    {"date": "2024-02-05", "volume": 105.0},
    {"date": "2024-02-12", "volume": 106.2},
    {"date": "2024-02-19", "volume": 105.8},
    {"date": "2024-02-26", "volume": 107.0},
]
res = build_forecast(pts, periods=3, interval_days=7, category="compound")
print("Noisy trend forecast:")
for f in res:
    print(f["value"], end=" ")
print()

scaled_pts = [
    {"date": point["date"], "volume": point["volume"] * 10}
    for point in pts
]
scaled_res = build_forecast(scaled_pts, periods=3, interval_days=7, category="compound")
for original, scaled in zip(res, scaled_res):
    assert abs(scaled["value"] - original["value"] * 10) < 0.1

print("\nAll tests passed!")
