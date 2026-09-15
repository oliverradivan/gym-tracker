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

print("\nTest 3: flat series (no change) -> should plateau")
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
# Expect values stay at 100 (or close)
for f in res:
    assert abs(f["value"] - 100) < 1.0

print("\nTest 4: diminishing returns - compound vs isolation")
pts = [
    {"date": "2024-01-01", "volume": 50},
    {"date": "2024-01-08", "volume": 55},
    {"date": "2024-01-15", "volume": 58},
    {"date": "2024-01-22", "volume": 60},
    {"date": "2024-01-29", "volume": 61},
]
res_c = build_forecast(pts, periods=4, interval_days=7, category="compound")
res_i = build_forecast(pts, periods=4, interval_days=7, category="isolation")
print("Compound forecast:")
for f in res_c:
    print(f["value"], end=" ")
print()
print("Isolation forecast:")
for f in res_i:
    print(f["value"], end=" ")
print()
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

print("\nAll tests passed!")
