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
    values = [float(point.get("volume", 0) or 0) for point in sorted_points]
    if len(values) < 2:
        return []

    recent_points = sorted_points[-9:]
    trend_points = []
    progression_intervals = []
    trend_origin = datetime.strptime(str(recent_points[0].get("date")), "%Y-%m-%d")
    for point in recent_points:
        value = float(point.get("volume", 0) or 0)
        if value <= 0:
            continue
        point_date = datetime.strptime(str(point.get("date")), "%Y-%m-%d")
        elapsed_weeks = (point_date - trend_origin).days / 7
        trend_points.append((elapsed_weeks, math.log(value)))

    for previous_point, current_point in zip(recent_points, recent_points[1:]):
        previous_value = float(previous_point.get("volume", 0) or 0)
        current_value = float(current_point.get("volume", 0) or 0)
        if previous_value <= 0 or current_value <= previous_value:
            continue
        previous_date = datetime.strptime(str(previous_point.get("date")), "%Y-%m-%d")
        current_date = datetime.strptime(str(current_point.get("date")), "%Y-%m-%d")
        progression_intervals.append(max((current_date - previous_date).days, 1))

    historical_weekly_gain = 0.0
    has_historical_trend = False
    if len(trend_points) >= 2:
        mean_week = sum(week for week, _ in trend_points) / len(trend_points)
        mean_log_value = sum(log_value for _, log_value in trend_points) / len(trend_points)
        week_variance = sum((week - mean_week) ** 2 for week, _ in trend_points)
        if week_variance > 0:
            log_slope = sum(
                (week - mean_week) * (log_value - mean_log_value)
                for week, log_value in trend_points
            ) / week_variance
            historical_weekly_gain = math.exp(log_slope) - 1
            has_historical_trend = True

    mean_progression_interval = (
        sum(progression_intervals) / len(progression_intervals)
        if progression_intervals
        else None
    )
    baseline_weekly_gain = (
        1.02 ** (7 / mean_progression_interval) - 1
        if mean_progression_interval is not None
        else 0.0
    )
    if mean_progression_interval is not None:
        min_weekly_gain = 0.90 ** (7 / mean_progression_interval) - 1
        max_weekly_gain = 1.10 ** (7 / mean_progression_interval) - 1
        historical_weekly_gain = min(
            max(historical_weekly_gain, min_weekly_gain),
            max_weekly_gain,
        )

    if has_historical_trend:
        history_weight = min(0.85, (len(trend_points) - 1) / 6 * 0.85)
        if historical_weekly_gain > 0 and baseline_weekly_gain > 0:
            weekly_gain = (
                historical_weekly_gain * history_weight
                + baseline_weekly_gain * (1 - history_weight)
            )
        else:
            weekly_gain = historical_weekly_gain * history_weight
    elif baseline_weekly_gain > 0:
        weekly_gain = baseline_weekly_gain
    else:
        weekly_gain = 0.0

    recent_deltas = [
        float(recent_points[index].get("volume", 0) or 0)
        - float(recent_points[index - 1].get("volume", 0) or 0)
        for index in range(1, len(recent_points))
    ]
    if len(recent_deltas) >= 2:
        mean_recent = sum(recent_deltas) / len(recent_deltas)
        variance = sum((delta - mean_recent) ** 2 for delta in recent_deltas) / len(recent_deltas)
        std_recent = math.sqrt(variance)
    else:
        mean_recent = 0.0
        std_recent = 0.0

    start_date = datetime.strptime(str(sorted_points[-1].get("date")), "%Y-%m-%d")
    forecast = []
    current_projected = values[-1]

    for step in range(1, max(1, periods) + 1):
        step_gain = weekly_gain / (1 + 0.15 * (step - 1))
        next_val = max(current_projected * (1 + step_gain) ** (max(1, interval_days) / 7), 0.0)
        next_date = start_date + timedelta(days=step * max(1, interval_days))

        base_conf = get_confidence_band_pct(len(values), step)
        if abs(mean_recent) > 1e-6:
            var_factor = 1.0 + (std_recent / abs(mean_recent))
        else:
            var_factor = 1.0
        var_factor = min(var_factor, 2.0)
        conf_pct = min(MAX_CONFIDENCE_BAND, base_conf * var_factor)

        lower = max(next_val * (1.0 - conf_pct), 0.0)
        upper = next_val * (1.0 + conf_pct)

        forecast.append(
            {
                "date": next_date.strftime("%Y-%m-%d"),
                "value": round(next_val, 2),
                "lower": round(lower, 2),
                "upper": round(upper, 2),
            }
        )
        current_projected = next_val
    return forecast
