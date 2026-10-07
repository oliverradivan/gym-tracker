from fastapi import APIRouter, Header, HTTPException
from postgrest.exceptions import APIError

from ..data_access import get_user_context
from ..schemas import PredictionsPayload
from ..services.forecast import (
    EXERCISE_MOVEMENT_CATEGORIES,
    MAX_FORECAST_INTERVAL_DAYS,
    MAX_FORECAST_PERIODS,
    build_forecast,
)

router = APIRouter(prefix="/api")


@router.post("/predictions")
def create_predictions(
    payload: PredictionsPayload,
    authorization: str | None = Header(default=None),
):
    client, _user = get_user_context(authorization)

    points: list[dict] = payload.points
    if not points or len(points) < 2:
        raise HTTPException(
            status_code=400,
            detail="Not enough data points for forecasting. Minimum 2 data points required.",
        )

    periods = min(max(1, payload.periods), MAX_FORECAST_PERIODS)
    interval_days = min(max(1, payload.interval_days), MAX_FORECAST_INTERVAL_DAYS)
    category = payload.category
    if payload.exercise_id:
        try:
            exercise_result = (
                client.table("exercises")
                .select("name")
                .eq("id", payload.exercise_id)
                .limit(1)
                .execute()
            )
        except APIError as exc:
            raise HTTPException(status_code=400, detail=f"Failed to load exercise: {exc.message}") from exc

        exercise_name = (exercise_result.data[0].get("name") if exercise_result.data else "") or ""
        category = EXERCISE_MOVEMENT_CATEGORIES.get(exercise_name.strip().lower(), category)

    try:
        predictions = build_forecast(
            points,
            periods=periods,
            interval_days=interval_days,
            category=category or "compound",
        )
    except (ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=400,
            detail="Invalid data points. Each point needs a 'date' (YYYY-MM-DD) and a numeric 'volume'.",
        ) from exc
    return {"predictions": predictions}
