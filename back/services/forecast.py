import math
from datetime import datetime, timedelta

MIN_CONFIDENCE_BAND = 0.10
MAX_CONFIDENCE_BAND = 0.30
CONFIDENCE_BAND_FULL_CONFIDENCE_POINTS = 20
CONFIDENCE_BAND_WIDENING_PER_OFFSET = 0.01
MAX_FORECAST_PERIODS = 90
MAX_FORECAST_INTERVAL_DAYS = 365
EXERCISE_MOVEMENT_CATEGORIES = {
    "bench press": "compound",
    "smith bench press": "compound",
    "machine bench press": "compound",
    "machine push press": "compound",
    "dumbbell bench press": "compound",
    "dumbbell shoulder press": "compound",
    "machine shoulder press": "compound",
    "cable machine shoulder press": "compound",
    "pull ups": "compound",
    "assisted pull ups": "compound",
    "lat pull down (wide)": "compound",
    "lat pull down (narrow)": "compound",
    "cable row (narrow)": "compound",
    "cable row (wide)": "compound",
    "machine row": "compound",
    "shrugs": "compound",
    "leg press": "compound",
    "reverse leg press": "compound",
    "cable tricep pulldowns": "isolation",
    "delt cable flys": "isolation",
    "delt machine flys": "isolation",
    "bicep curls": "isolation",
    "machine bicep curls": "isolation",
    "rear delts": "isolation",
    "leg extensions": "isolation",
    "bed hamstring curl": "isolation",
    "manchester hamstring curl": "isolation",
    "inside leg": "isolation",
    "outside leg": "isolation",
    "sitting calf raises": "isolation",
    "crunch machine": "isolation",
    "crunches": "isolation",
}


def get_confidence_band_pct(history_points: int, forecast_offset: int = 1) -> float:
    history_ratio = min(
        max(history_points - 2, 0)
        / max(CONFIDENCE_BAND_FULL_CONFIDENCE_POINTS - 2, 1),
        1.0,
    )
    history_band = MAX_CONFIDENCE_BAND - (
        (MAX_CONFIDENCE_BAND - MIN_CONFIDENCE_BAND) * history_ratio
    )
    forecast_widening = max(forecast_offset - 1, 0) * CONFIDENCE_BAND_WIDENING_PER_OFFSET
    return min(MAX_CONFIDENCE_BAND, history_band + forecast_widening)


def _volume(point: dict) -> float:
    return float(point.get("volume", 0) or 0)


def _trend_points(recent_points: list[dict]) -> list[tuple[float, float]]:
    origin = datetime.strptime(str(recent_points[0].get("date")), "%Y-%m-%d")
    trend_points = []
    for point in recent_points:
        value = _volume(point)
        if value <= 0:
            continue
        point_date = datetime.strptime(str(point.get("date")), "%Y-%m-%d")
        elapsed_weeks = (point_date - origin).days / 7
        trend_points.append((elapsed_weeks, math.log(value)))
    return trend_points


def _progression_intervals(recent_points: list[dict]) -> list[int]:
    intervals = []
    for previous_point, current_point in zip(recent_points, recent_points[1:]):
        previous_value = _volume(previous_point)
        current_value = _volume(current_point)
        if previous_value <= 0 or current_value <= previous_value:
            continue
        previous_date = datetime.strptime(str(previous_point.get("date")), "%Y-%m-%d")
        current_date = datetime.strptime(str(current_point.get("date")), "%Y-%m-%d")
        intervals.append(max((current_date - previous_date).days, 1))
    return intervals


def _historical_weekly_gain(
    trend_points: list[tuple[float, float]],
) -> tuple[float, bool]:
    if len(trend_points) < 2:
        return 0.0, False

    mean_week = sum(week for week, _ in trend_points) / len(trend_points)
    mean_log_value = sum(value for _, value in trend_points) / len(trend_points)
    week_variance = sum((week - mean_week) ** 2 for week, _ in trend_points)
    if week_variance == 0:
        return 0.0, False

    log_slope = sum(
        (week - mean_week) * (value - mean_log_value)
        for week, value in trend_points
    ) / week_variance
    return math.exp(log_slope) - 1, True


def _weekly_gain(
    trend_points: list[tuple[float, float]],
    progression_intervals: list[int],
) -> float:
    historical_gain, has_historical_trend = _historical_weekly_gain(trend_points)
    mean_interval = (
        sum(progression_intervals) / len(progression_intervals)
        if progression_intervals
        else None
    )

    baseline_gain = 0.0
    if mean_interval is not None:
        baseline_gain = 1.02 ** (7 / mean_interval) - 1
        min_gain = 0.90 ** (7 / mean_interval) - 1
        max_gain = 1.10 ** (7 / mean_interval) - 1
        historical_gain = min(max(historical_gain, min_gain), max_gain)

    if has_historical_trend:
        history_weight = min(0.85, (len(trend_points) - 1) / 6 * 0.85)
        if historical_gain > 0 and baseline_gain > 0:
            return (
                historical_gain * history_weight
                + baseline_gain * (1 - history_weight)
            )
        return historical_gain * history_weight
    if baseline_gain > 0:
        return baseline_gain
    return 0.0


def _recent_delta_stats(recent_points: list[dict]) -> tuple[float, float]:
    deltas = [
        _volume(recent_points[index]) - _volume(recent_points[index - 1])
        for index in range(1, len(recent_points))
    ]
    if len(deltas) < 2:
        return 0.0, 0.0

    mean_delta = sum(deltas) / len(deltas)
    variance = sum((delta - mean_delta) ** 2 for delta in deltas) / len(deltas)
    return mean_delta, math.sqrt(variance)


def _forecast_periods(
    start_date: datetime,
    current_projected: float,
    periods: int,
    interval_days: int,
    weekly_gain: float,
    history_points: int,
    mean_recent: float,
    std_recent: float,
) -> list[dict]:
    forecast = []
    safe_interval = max(1, interval_days)
    for step in range(1, max(1, periods) + 1):
        step_gain = weekly_gain / (1 + 0.15 * (step - 1))
        next_value = max(
            current_projected * (1 + step_gain) ** (safe_interval / 7),
            0.0,
        )
        next_date = start_date + timedelta(days=step * safe_interval)

        confidence = get_confidence_band_pct(history_points, step)
        variation_factor = (
            1.0 + std_recent / abs(mean_recent)
            if abs(mean_recent) > 1e-6
            else 1.0
        )
        confidence = min(MAX_CONFIDENCE_BAND, confidence * min(variation_factor, 2.0))

        forecast.append(
            {
                "date": next_date.strftime("%Y-%m-%d"),
                "value": round(next_value, 2),
                "lower": round(max(next_value * (1.0 - confidence), 0.0), 2),
                "upper": round(next_value * (1.0 + confidence), 2),
            }
        )
        current_projected = next_value
    return forecast


def build_forecast(
    points: list[dict],
    periods: int = 7,
    interval_days: int = 1,
    category: str = "compound",
) -> list[dict]:
    """
    Forecast future volume (weight*reps) using a model that captures:
    - Conservative, gradually slowing strength gains.
    - A time-normalized historical rate blended with a conservative progression baseline.
    - History-dependent weighting that preserves flat or declining trends.
    - Confidence bands that widen with uncertainty and variability.
    """
    if not points:
        return []

    sorted_points = sorted(points, key=lambda item: str(item.get("date", "")))
    values = [_volume(point) for point in sorted_points]
    if len(values) < 2:
        return []

    recent_points = sorted_points[-9:]
    weekly_gain = _weekly_gain(
        _trend_points(recent_points),
        _progression_intervals(recent_points),
    )
    mean_recent, std_recent = _recent_delta_stats(recent_points)
    start_date = datetime.strptime(str(sorted_points[-1].get("date")), "%Y-%m-%d")
    return _forecast_periods(
        start_date,
        values[-1],
        periods,
        interval_days,
        weekly_gain,
        len(values),
        mean_recent,
        std_recent,
    )
