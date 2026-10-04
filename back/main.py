import os
import re
import time
import logging
from typing import Optional
import math

from datetime import datetime, timedelta

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from postgrest.exceptions import APIError
from pydantic import BaseModel, Field
from supabase import Client, create_client
from supabase_auth.errors import AuthApiError


class PredictionsPayload(BaseModel):
    points: list[dict[str, str | float | int]]
    periods: int = 7
    interval_days: int = 1
    exercise_id: str | None = None
    category: str | None = None


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

load_dotenv()

logger = logging.getLogger(__name__)


def get_supabase_config() -> tuple[str | None, str | None]:
    return os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY")


app = FastAPI(title="Workout Tracker API")
router = APIRouter(prefix="/api")

LOCAL_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]


def get_cors_origins() -> list[str]:
    # Local dev origins are only allowed when APP_ENV=local. For production
    # with a frontend on a different domain, set CORS_ALLOWED_ORIGINS to a
    # comma-separated list, e.g. "https://my-app.vercel.app".
    origins: list[str] = []
    if os.getenv("APP_ENV") == "local":
        origins.extend(LOCAL_CORS_ORIGINS)
    extra = os.getenv("CORS_ALLOWED_ORIGINS", "")
    origins.extend(origin.strip() for origin in extra.split(",") if origin.strip())
    return origins


_cors_origins = get_cors_origins()
if _cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# This is the ONLY client used for table operations (profiles, etc).
# CRITICAL: never call supabase.auth.sign_up / sign_in_with_password on this
# client. Those calls attach the resulting user's session/JWT to the client
# they're called on, which silently replaces the secret-key Authorization
# header with that user's low-privilege token on every later call - causing
# RLS to kick in on a client you thought was admin/service-role.
supabase: Optional[Client] = None
_supabase_url, _supabase_key = get_supabase_config()
if _supabase_url and _supabase_key:
    supabase = create_client(_supabase_url, _supabase_key)

RATE_LIMIT_BUCKETS: dict[str, list[float]] = {}


RATE_LIMIT_MAX_TRACKED = 5000
RATE_LIMIT_MAX_AGE_SECONDS = 3600


def prune_rate_limit_buckets(now: float) -> None:
    stale_keys = [
        key
        for key, bucket in RATE_LIMIT_BUCKETS.items()
        if not bucket or now - bucket[-1] > RATE_LIMIT_MAX_AGE_SECONDS
    ]
    for key in stale_keys:
        del RATE_LIMIT_BUCKETS[key]


def check_rate_limit(identifier: str, max_requests: int = 5, window_seconds: int = 60) -> None:
    # NOTE: this limiter is in-memory, so each process / serverless instance
    # keeps its own counters and they reset on restart or cold start. For a
    # hard guarantee, move it to Redis/Upstash or a database table.
    now = time.time()
    if len(RATE_LIMIT_BUCKETS) > RATE_LIMIT_MAX_TRACKED:
        prune_rate_limit_buckets(now)
    bucket = RATE_LIMIT_BUCKETS.setdefault(identifier, [])
    bucket[:] = [timestamp for timestamp in bucket if now - timestamp < window_seconds]

    if len(bucket) >= max_requests:
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please wait a moment and try again.",
        )

    bucket.append(now)


def get_client_ip(request: Request) -> str:
    # Only trust proxy headers when running behind a proxy that overwrites them
    # (e.g. Vercel). Otherwise a client can spoof x-forwarded-for to dodge the
    # rate limiter - set TRUST_PROXY_HEADERS=false in that case.
    if os.getenv("TRUST_PROXY_HEADERS", "true").lower() == "false":
        return request.client.host if request.client else "unknown"

    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",", 1)[0].strip() or "unknown"

    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip() or "unknown"

    return request.client.host if request.client else "unknown"


def get_auth_client() -> Client:
    """
    Returns a fresh, throwaway Supabase client for auth operations that set
    a session (sign_up, sign_in_with_password). Creating a client is cheap
    (no network call), and keeping it separate from the module-level
    `supabase` client guarantees the admin client's session never gets
    contaminated by a user's JWT - which is what was causing the RLS
    violation on profile inserts.
    """
    supabase_url, supabase_key = get_supabase_config()
    if not supabase_url or not supabase_key:
        raise HTTPException(status_code=500, detail="Supabase is not configured.")

    return create_client(supabase_url, supabase_key)


def normalize_username(raw_username: str) -> str:
    cleaned = (raw_username or "").strip().lower()
    cleaned = re.sub(r"[^a-z0-9]", "", cleaned)

    if not cleaned:
        raise ValueError("Username is required.")
    if len(cleaned) < 3:
        raise ValueError("Username must be at least 3 characters long.")
    if len(cleaned) > 24:
        raise ValueError("Username must be 24 characters or fewer.")

    return cleaned


class RegisterPayload(BaseModel):
    username: str
    email: str
    password: str


class LoginPayload(BaseModel):
    username: str | None = None
    email: str | None = None
    password: str


class RefreshPayload(BaseModel):
    refresh_token: str


class WorkoutPayload(BaseModel):
    workout_name: str
    duration_minutes: int
    workout_date: str
    notes: str | None = None

class UpdateUsernamePayload(BaseModel):
    username: str


class UpdatePasswordPayload(BaseModel):
    current_password: str
    new_password: str


class DeleteAccountPayload(BaseModel):
    password: str

class ExercisePayload(BaseModel):
    name: str


class ExerciseUpdatePayload(BaseModel):
    name: str


class WorkoutLogPayload(BaseModel):
    exercise_id: str
    log_date: str
    weight: float | None = None
    reps: float | None = None
    duration_seconds: int | None = Field(default=None, strict=True)


CARDIO_EXERCISE_PATTERN = re.compile(
    r"\b(run(?:ning)?|jog(?:ging)?|treadmill|bike|cycling|cycle|"
    r"row(?:ing)? machine|rower|swim(?:ming)?|walk(?:ing)?|elliptical|"
    r"stair\w*|jump rope|skipping|cardio)\b",
    re.IGNORECASE,
)


def get_exercise_category(name: str = "") -> str:
    """
    Rough bucket for an exercise name: cardio / leg / push / pull / other.

    Only "cardio" vs. not-cardio changes validation. Names that match nothing
    fall back to "other" (treated like strength work) instead of "cardio", so
    custom exercises such as "Plank" or "Farmer carry" still accept weight and
    reps. Patterns use word boundaries so "narrow" doesn't match "row" and
    "lateral" doesn't match "lat".
    """
    value = (name or "").lower()
    if CARDIO_EXERCISE_PATTERN.search(value):
        return "cardio"

    explicit_leg = [
        "bed hamstring curl",
        "crunch machine",
        "crunches",
        "leg press",
        "manchester hamstring curl",
        "reverse leg press",
        "leg extensions",
        "sitting calf raises",
        "inside leg",
        "outside leg",
        "squat",
        "hamstring",
        "calf",
        "lunge",
    ]
    if any(entry in value for entry in explicit_leg):
        return "leg"
    if re.search(
        r"(cable tricep pull[- ]?down(?:s)?|tricep pull[- ]?down(?:s)?|"
        r"single arm tricep pulldown(?:s)?|straight bar tricep pulldown(?:s)?)",
        value,
        re.IGNORECASE,
    ):
        return "push"
    # Leg check comes before pull so "leg curl" isn't treated as a bicep curl.
    if re.search(
        r"\b(?:legs?|squats?|hamstrings?|calf|calves|lunges?|glutes?|hip thrusts?)\b",
        value,
        re.IGNORECASE,
    ):
        return "leg"
    if re.search(
        r"\b(?:rear delts?|pull ?ups?|chin ?ups?|pull ?downs?|pulls?|rows?|lats?|"
        r"curls?|shrugs?|biceps?|deadlifts?)\b",
        value,
        re.IGNORECASE,
    ):
        return "pull"
    if re.search(
        r"\b(?:bench|press|shoulder|chest|tricep|push|dips?|fly|flys|flies|"
        r"incline|lateral raises?|delts?)",
        value,
        re.IGNORECASE,
    ):
        return "push"
    return "other"


def validate_workout_log_payload(payload: WorkoutLogPayload, exercise_name: str) -> None:
    category = get_exercise_category(exercise_name)
    if category == "cardio":
        if payload.duration_seconds is None or payload.duration_seconds <= 0:
            raise ValueError("Duration must be greater than zero for cardio exercises.")
        if payload.weight is not None or payload.reps is not None:
            raise ValueError("Weight and reps are not accepted for cardio exercises.")
        return

    if payload.duration_seconds is not None:
        raise ValueError("Duration is only accepted for cardio exercises.")
    if payload.weight is None:
        raise ValueError("Weight is required for non-cardio exercises.")
    if payload.reps is None:
        raise ValueError("Reps are required for non-cardio exercises.")
    if payload.weight < 0:
        raise ValueError("Weight must be zero or greater.")
    if payload.reps <= 0:
        raise ValueError("Reps must be greater than zero.")


def normalize_exercise_name(raw_name: str) -> str:
    cleaned = (raw_name or "").strip()
    cleaned = re.sub(r"[_-]+", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned)
    cleaned = cleaned.strip()

    if not cleaned:
        raise ValueError("Exercise name is required.")
    if len(cleaned) > 80:
        raise ValueError("Exercise name must be 80 characters or fewer.")

    return cleaned


def build_progress_series(rows, is_cardio: bool = False):
    if is_cardio:
        result = []
        for row in rows or []:
            date_value = row.get("log_date")
            duration = row.get("duration_seconds")
            if not date_value or duration is None or int(duration) <= 0:
                continue
            result.append({
                "date": date_value,
                "duration_seconds": int(duration),
            })
        return result

    grouped = {}

    for row in rows or []:
        date_value = row.get("log_date")
        if not date_value:
            continue

        weight = float(row.get("weight") or 0)
        reps = float(row.get("reps") or 0)
        volume = weight * reps

        if date_value not in grouped:
            grouped[date_value] = {"date": date_value, "volume": 0.0, "reps": 0.0, "weight": 0.0}

        grouped[date_value]["volume"] += volume
        grouped[date_value]["reps"] += reps
        grouped[date_value]["weight"] += weight

    result = []
    for date_value in sorted(grouped):
        entry = grouped[date_value]
        volume_value = entry["volume"]
        if float(volume_value).is_integer():
            volume_value = int(volume_value)

        reps_value = entry["reps"]
        if float(reps_value).is_integer():
            reps_value = int(reps_value)

        weight_value = entry["weight"]
        if float(weight_value).is_integer():
            weight_value = int(weight_value)

        result.append({
            "date": entry["date"],
            "volume": volume_value,
            "reps": reps_value,
            "weight": weight_value,
        })

    return result


def build_session_summary(rows):
    grouped = {}

    for row in rows or []:
        date_value = row.get("log_date")
        if not date_value:
            continue

        exercise_name = row.get("exercises", {}).get("name") if isinstance(row.get("exercises"), dict) else None
        if not exercise_name:
            exercise_name = "Unknown Exercise"

        is_cardio = get_exercise_category(exercise_name) == "cardio"
        weight_val = float(row.get("weight") or 0) if not is_cardio else 0
        reps_val = float(row.get("reps") or 0) if not is_cardio else 0
        weight = int(weight_val) if weight_val.is_integer() else weight_val
        reps = int(reps_val) if reps_val.is_integer() else reps_val
        duration = row.get("duration_seconds") if is_cardio else None
        duration = int(duration) if duration is not None else None
        volume = weight_val * reps_val
        if float(volume).is_integer():
            volume = int(volume)
        log_id = row.get("id")
        exercise_id = row.get("exercise_id")

        if date_value not in grouped:
            grouped[date_value] = {"date": date_value, "total_volume": 0.0, "entries": []}

        grouped[date_value]["total_volume"] += volume
        grouped[date_value]["entries"].append(
            {
                "log_id": log_id,
                "exercise_id": exercise_id,
                "exercise_name": exercise_name,
                "weight": None if is_cardio else weight,
                "reps": None if is_cardio else reps,
                "volume": volume,
                "duration_seconds": duration,
            }
        )

    result = []
    for date_value in sorted(grouped, reverse=True):
        session = grouped[date_value]
        volume_value = session["total_volume"]
        if float(volume_value).is_integer():
            volume_value = int(volume_value)
        result.append({
            "date": session["date"],
            "total_volume": volume_value,
            "entries": session["entries"],
        })

    return result


# Fit recent workout values and taper the resulting rate across forecast steps.
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

    # Sort chronologically and extract the volume metric.
    sorted_points = sorted(points, key=lambda item: str(item.get("date", "")))
    values = [float(point.get("volume", 0) or 0) for point in sorted_points]
    if len(values) < 2:
        return []

    # Fit a relative trend to recent positive workout values, accounting for
    # the actual time between sessions rather than assuming weekly workouts.
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

    # ACSM recommends a 2-10% load increase only after exceeding the target
    # reps. Use its lower bound per observed positive workout interval, not per
    # calendar month (Ratamess et al., doi:10.1249/MSS.0b013e3181915670).
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

    # --- 2. Variability of recent changes (for confidence) ---
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

    # --- 3. Generate gradually slowing forecast points ---
    start_date = datetime.strptime(str(sorted_points[-1].get("date")), "%Y-%m-%d")
    forecast = []
    current_projected = values[-1]

    for step in range(1, max(1, periods) + 1):
        step_gain = weekly_gain / (1 + 0.15 * (step - 1))
        next_val = max(current_projected * (1 + step_gain) ** (max(1, interval_days) / 7), 0.0)

        next_date = start_date + timedelta(days=step * max(1, interval_days))

        # --- 4. Confidence band ---
        base_conf = get_confidence_band_pct(len(values), step)
        # Widen band if recent delta variability is high relative to the mean trend.
        if abs(mean_recent) > 1e-6:
            var_factor = 1.0 + (std_recent / abs(mean_recent))
        else:
            var_factor = 1.0
        var_factor = min(var_factor, 2.0)  # cap the widening effect
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


def get_authenticated_user(authorization: str | None):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid bearer token.")

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing or invalid bearer token.")

    try:
        response = supabase.auth.get_user(token)
    except AuthApiError as exc:
        raise HTTPException(status_code=401, detail=exc.message) from exc
    except Exception as exc:
        # Some invalid/expired-token cases raise other auth error classes.
        logger.warning("Token verification failed: %s", exc)
        raise HTTPException(status_code=401, detail="Invalid or expired token.") from exc

    user = getattr(response, "user", None) if response else None
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    return user


@router.get("/health")
def health_status():
    return {
        "status": "ok",
        "supabase_connected": supabase is not None,
    }


@router.post("/auth/register")
def register_user(payload: RegisterPayload, request: Request):
    if supabase is None:
        raise HTTPException(status_code=500, detail="Supabase is not configured.")

    client_ip = get_client_ip(request)
    email_key = (payload.email or "").strip().lower()
    check_rate_limit(f"auth:register:{client_ip}", max_requests=5, window_seconds=60)
    if email_key:
        check_rate_limit(f"auth:register:{email_key}", max_requests=3, window_seconds=3600)

    try:
        username = normalize_username(payload.username)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if len(payload.password or "") < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")

    email = (payload.email or "").strip()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="A valid email is required.")

    # Check for existing username - uses the clean admin client, safe.
    try:
        existing_user = (
            supabase.table("profiles")
            .select("username")
            .eq("username", username)
            .limit(1)
            .execute()
        )
        if existing_user.data:
            raise HTTPException(status_code=409, detail="Username already exists.")
    except APIError as exc:
        raise HTTPException(status_code=400, detail=f"Database error: {exc.message}") from exc

    # Create Supabase Auth account on a THROWAWAY client, not the admin one.
    # This is the fix: sign_up() attaches the new user's session to whatever
    # client it's called on. Using a separate client here means our shared
    # `supabase` admin client never picks up that session.
    auth_client = get_auth_client()
    try:
        auth_response = auth_client.auth.sign_up(
            {
                "email": email,
                "password": payload.password,
                "options": {"data": {"username": username, "full_name": username}},
            }
        )
    except AuthApiError as exc:
        raise HTTPException(status_code=exc.status or 400, detail=exc.message) from exc
    except Exception as exc:
        logger.exception("Unexpected error during registration")
        raise HTTPException(status_code=500, detail="Internal server error") from exc

    # Insert Profile - back on the clean admin client, so this still bypasses RLS.
    if auth_response.user is not None:
        try:
            supabase.table("profiles").upsert(
                {
                    "id": auth_response.user.id,
                    "username": username,
                    "email": email,
                },
                on_conflict="id",
            ).execute()
        except APIError as exc:
            # Don't leave an auth account behind with no profile.
            try:
                supabase.auth.admin.delete_user(auth_response.user.id)
            except Exception:
                logger.exception("Failed to clean up auth user after profile creation error")

            # 23505 = unique violation (e.g. two people grabbed the same username at once).
            if getattr(exc, "code", None) == "23505":
                raise HTTPException(status_code=409, detail="Username already exists.") from exc
            raise HTTPException(
                status_code=400, detail=f"Failed to create profile: {exc.message}"
            ) from exc

    # If email confirmation is required, Supabase returns a user but no session
    email_confirmation_required = (
        auth_response.user is not None and auth_response.session is None
    )

    return {
        "message": "User created successfully.",
        "username": username,
        "user": auth_response.user,
        "session": auth_response.session,
        "email_confirmation_required": email_confirmation_required,
    }


@router.post("/auth/login")
def login_user(payload: LoginPayload, request: Request):
    if supabase is None:
        raise HTTPException(status_code=500, detail="Supabase is not configured.")

    client_ip = get_client_ip(request)
    check_rate_limit(f"auth:login:{client_ip}", max_requests=5, window_seconds=60)

    target_email = (payload.email or "").strip()

    # If the frontend put an email into the username field, treat it as an
    # email. normalize_username would strip the "@" and "." and break the login.
    if not target_email and payload.username and "@" in payload.username:
        target_email = payload.username.strip()

    # Look up email by username if email was not supplied directly.
    # Uses the clean admin client - safe, no session attached here.
    if not target_email and payload.username:
        try:
            username = normalize_username(payload.username)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        try:
            profile = (
                supabase.table("profiles")
                .select("email")
                .eq("username", username)
                .limit(1)
                .execute()
            )
            if not profile.data:
                raise HTTPException(status_code=401, detail="oops! something was incorrect.")
            target_email = profile.data[0]["email"]
        except APIError as exc:
            raise HTTPException(status_code=400, detail=exc.message) from exc

    if not target_email:
        raise HTTPException(status_code=400, detail="Email or username is required.")

    # Sign in on a THROWAWAY client - same reasoning as register. This keeps
    # the shared admin client's session permanently clean, so it can never
    # leak one user's JWT into another request's table operations.
    auth_client = get_auth_client()
    try:
        auth_response = auth_client.auth.sign_in_with_password(
            {"email": target_email, "password": payload.password}
        )
    except AuthApiError as exc:
        raise HTTPException(status_code=401, detail="oops! something was incorrect.") from exc
    except Exception as exc:
        logger.exception("Unexpected error during login")
        raise HTTPException(status_code=500, detail="Internal server error") from exc

    return {
        "message": "Login successful.",
        "user": auth_response.user,
        "session": auth_response.session,
    }


@router.post("/auth/refresh")
def refresh_session(payload: RefreshPayload):
    if supabase is None:
        raise HTTPException(status_code=500, detail="Supabase is not configured.")

    # Same reasoning as login/register: use a throwaway client so the
    # refreshed session never contaminates the shared admin client.
    auth_client = get_auth_client()
    try:
        auth_response = auth_client.auth.refresh_session(payload.refresh_token)
    except AuthApiError as exc:
        raise HTTPException(status_code=401, detail=exc.message) from exc

    return {
        "message": "Session refreshed.",
        "user": auth_response.user,
        "session": auth_response.session,
    }


@router.get("/profile")
def get_profile(authorization: str | None = Header(default=None)):
    if supabase is None:
        raise HTTPException(status_code=500, detail="Supabase is not configured.")

    user = get_authenticated_user(authorization)
    return {"user": user}


@router.patch("/profile/username")
def update_username(
    payload: UpdateUsernamePayload,
    authorization: str | None = Header(default=None),
):
    if supabase is None:
        raise HTTPException(status_code=500, detail="Supabase is not configured.")

    user = get_authenticated_user(authorization)

    try:
        new_username = normalize_username(payload.username)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # Check if username already exists
    try:
        existing_user = (
            supabase.table("profiles")
            .select("username")
            .eq("username", new_username)
            .neq("id", user.id)
            .limit(1)
            .execute()
        )
        if existing_user.data:
            raise HTTPException(status_code=409, detail="Username already exists.")
    except APIError as exc:
        raise HTTPException(status_code=400, detail=f"Database error: {exc.message}") from exc

    # Update username in profiles table
    try:
        supabase.table("profiles").update(
            {"username": new_username}
        ).eq("id", user.id).execute()
    except APIError as exc:
        raise HTTPException(status_code=400, detail=f"Failed to update username: {exc.message}") from exc

    # Update user metadata in auth via admin client
    try:
        supabase.auth.admin.update_user_by_id(
            user.id,
            {"user_metadata": {"username": new_username, "full_name": new_username}},
        )
    except Exception:
        pass

    return {"message": "Username updated successfully", "username": new_username}


@router.patch("/profile/password")
def update_password(
    payload: UpdatePasswordPayload,
    authorization: str | None = Header(default=None),
):
    if supabase is None:
        raise HTTPException(status_code=500, detail="Supabase is not configured.")

    user = get_authenticated_user(authorization)

    if len(payload.new_password or "") < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters long.")

    # Verify current password by attempting login
    user_email = user.email
    try:
        auth_client = get_auth_client()
        # Try to sign in with current password to verify it
        auth_client.auth.sign_in_with_password(
            {"email": user_email, "password": payload.current_password}
        )
    except AuthApiError as exc:
        raise HTTPException(status_code=401, detail="Current password is incorrect.") from exc

    # Update password using admin API
    try:
        supabase.auth.admin.update_user_by_id(
            user.id,
            {"password": payload.new_password},
        )
    except Exception as exc:
        logger.exception("Failed to update password")
        raise HTTPException(status_code=400, detail="Failed to update password.") from exc

    return {"message": "Password updated successfully"}


@router.delete("/profile")
def delete_account(
    payload: DeleteAccountPayload,
    authorization: str | None = Header(default=None),
):
    if supabase is None:
        raise HTTPException(status_code=500, detail="Supabase is not configured.")

    user = get_authenticated_user(authorization)

    # Verify password
    user_email = user.email
    try:
        auth_client = get_auth_client()
        auth_client.auth.sign_in_with_password(
            {"email": user_email, "password": payload.password}
        )
    except AuthApiError as exc:
        raise HTTPException(status_code=401, detail="Password is incorrect.") from exc

    profile_snapshot = None
    try:
        existing_profile = (
            supabase.table("profiles")
            .select("*")
            .eq("id", user.id)
            .limit(1)
            .execute()
        )
        if existing_profile.data:
            profile_snapshot = existing_profile.data[0]
    except APIError as exc:
        raise HTTPException(status_code=400, detail=f"Failed to load profile: {exc.message}") from exc

    try:
        supabase.table("profiles").delete().eq("id", user.id).execute()
    except APIError as exc:
        raise HTTPException(status_code=400, detail=f"Failed to delete profile: {exc.message}") from exc

    # Delete user from auth (admin operation using service role key). If the auth
    # deletion fails after we already removed the profile row, restore the profile
    # so the user data is not lost unexpectedly.
    try:
        supabase.auth.admin.delete_user(user.id)
    except Exception as exc:
        logger.exception("Auth user deletion failed")
        if profile_snapshot:
            try:
                supabase.table("profiles").upsert(profile_snapshot, on_conflict="id").execute()
            except APIError as restore_exc:
                logger.error("Profile recovery failed: %s", restore_exc.message)
                raise HTTPException(
                    status_code=500,
                    detail=(
                        "Failed to delete account, and the profile could not be restored. "
                        "Please contact support."
                    ),
                ) from exc

        raise HTTPException(
            status_code=500,
            detail="Failed to delete account. Nothing was changed, please try again.",
        ) from exc

    return {"message": "Account deleted successfully"}


@router.get("/exercises")
def list_exercises(authorization: str | None = Header(default=None)):
    if supabase is None:
        raise HTTPException(status_code=500, detail="Supabase is not configured.")

    user = get_authenticated_user(authorization)

    try:
        result = (
            supabase.table("exercises")
            .select("*")
            # Global exercises (created_by is null) plus this user's own custom ones.
            .or_(f"created_by.is.null,created_by.eq.{user.id}")
            .order("category")
            .order("name")
            .execute()
        )
    except APIError as exc:
        raise HTTPException(status_code=400, detail=f"Failed to load exercises: {exc.message}") from exc

    return {"exercises": result.data}


@router.post("/exercises")
def create_exercise(
    payload: ExercisePayload,
    authorization: str | None = Header(default=None),
):
    if supabase is None:
        raise HTTPException(status_code=500, detail="Supabase is not configured.")

    user = get_authenticated_user(authorization)

    try:
        name = normalize_exercise_name(payload.name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        visible = (
            supabase.table("exercises")
            .select("*")
            # Only collide with exercises this user can actually see (global + their own).
            .or_(f"created_by.is.null,created_by.eq.{user.id}")
            .execute()
        )
        # Compare in Python instead of using ilike: ilike treats % and _ as
        # wildcards, so a name like "b%" would match "Bench Press".
        wanted = name.casefold()
        match = next(
            (
                row
                for row in (visible.data or [])
                if (row.get("name") or "").strip().casefold() == wanted
            ),
            None,
        )
        if match:
            return {"exercise": match, "created": False}
    except APIError as exc:
        raise HTTPException(status_code=400, detail=f"Failed to check exercise name: {exc.message}") from exc

    try:
        created = (
            supabase.table("exercises")
            # created_by makes this exercise private to the user who added it -
            # it will not show up in anyone else's exercise list.
            .insert({"name": name, "created_by": user.id})
            .execute()
        )
    except APIError as exc:
        raise HTTPException(status_code=400, detail=f"Failed to create exercise: {exc.message}") from exc

    return {"exercise": created.data[0], "created": True}


@router.patch("/exercises/{exercise_id}")
def update_exercise(
    exercise_id: str,
    payload: ExerciseUpdatePayload,
    authorization: str | None = Header(default=None),
):
    if supabase is None:
        raise HTTPException(status_code=500, detail="Supabase is not configured.")

    get_authenticated_user(authorization)

    raise HTTPException(status_code=403, detail="Exercise updates are not allowed. Exercises are managed globally.")


@router.delete("/exercises/{exercise_id}")
def delete_exercise(
    exercise_id: str,
    authorization: str | None = Header(default=None),
):
    if supabase is None:
        raise HTTPException(status_code=500, detail="Supabase is not configured.")

    user = get_authenticated_user(authorization)

    try:
        existing = (
            supabase.table("exercises")
            .select("id, created_by")
            .eq("id", exercise_id)
            .limit(1)
            .execute()
        )
    except APIError as exc:
        raise HTTPException(status_code=400, detail=f"Failed to look up exercise: {exc.message}") from exc

    if not existing.data:
        raise HTTPException(status_code=404, detail="Exercise not found.")

    exercise_row = existing.data[0]
    if exercise_row.get("created_by") != user.id:
        # Global exercises (created_by is null) and other users' custom
        # exercises can't be removed - only the exercise's own creator can.
        raise HTTPException(
            status_code=403,
            detail="You can only delete exercises you created yourself.",
        )

    try:
        supabase.table("exercises").delete().eq("id", exercise_id).eq(
            "created_by", user.id
        ).execute()
    except APIError as exc:
        raise HTTPException(
            status_code=400,
            detail=(
                "Failed to delete exercise. If it's used in existing workout logs, "
                f"remove those logs first. ({exc.message})"
            ),
        ) from exc

    return {"message": "Exercise deleted successfully."}


@router.post("/workout-logs")
def create_workout_log(
    payload: WorkoutLogPayload,
    authorization: str | None = Header(default=None),
):
    if supabase is None:
        raise HTTPException(status_code=500, detail="Supabase is not configured.")

    user = get_authenticated_user(authorization)

    try:
        existing_exercise = (
            supabase.table("exercises")
            .select("id, name")
            .eq("id", payload.exercise_id)
            .limit(1)
            .execute()
        )
        if not existing_exercise.data:
            raise HTTPException(status_code=404, detail="Exercise not found.")
    except APIError as exc:
        raise HTTPException(status_code=400, detail=f"Exercise validation failed: {exc.message}") from exc

    exercise_name = existing_exercise.data[0].get("name") or ""
    try:
        validate_workout_log_payload(payload, exercise_name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        # Next set number for this exercise on this day (instead of always 1).
        last_set = (
            supabase.table("workout_logs")
            .select("set_number")
            .eq("user_id", user.id)
            .eq("exercise_id", payload.exercise_id)
            .eq("log_date", payload.log_date)
            .order("set_number", desc=True)
            .limit(1)
            .execute()
        )
        next_set_number = (
            (last_set.data[0].get("set_number") or 0) + 1 if last_set.data else 1
        )

        created = (
            supabase.table("workout_logs")
            .insert(
                {
                    "user_id": user.id,
                    "exercise_id": payload.exercise_id,
                    "log_date": payload.log_date,
                    "weight": payload.weight,
                    "reps": payload.reps,
                    "duration_seconds": payload.duration_seconds,
                    "set_number": next_set_number,
                }
            )
            .execute()
        )
    except APIError as exc:
        raise HTTPException(status_code=400, detail=f"Failed to save workout log: {exc.message}") from exc

    return {"message": "Workout logged successfully.", "log": created.data[0] if created.data else None}


@router.get("/workout-logs")
def get_workout_logs(
    exercise_id: str | None = None,
    authorization: str | None = Header(default=None),
):
    if supabase is None:
        raise HTTPException(status_code=500, detail="Supabase is not configured.")

    user = get_authenticated_user(authorization)

    query = supabase.table("workout_logs").select("*, exercises(name)").eq("user_id", user.id)
    if exercise_id:
        query = query.eq("exercise_id", exercise_id)

    try:
        result = query.order("log_date", desc=True).order("created_at", desc=True).execute()
    except APIError as exc:
        raise HTTPException(status_code=400, detail=f"Failed to load workout logs: {exc.message}") from exc

    return {"logs": result.data}


@router.delete("/workout-logs/{log_id}")
def delete_workout_log(
    log_id: str,
    authorization: str | None = Header(default=None),
):
    if supabase is None:
        raise HTTPException(status_code=500, detail="Supabase is not configured.")

    user = get_authenticated_user(authorization)

    try:
        deleted = (
            supabase.table("workout_logs")
            .delete()
            .eq("id", log_id)
            .eq("user_id", user.id)
            .execute()
        )
    except APIError as exc:
        raise HTTPException(status_code=400, detail=f"Failed to delete workout: {exc.message}") from exc

    if not deleted.data:
        raise HTTPException(status_code=404, detail="Workout not found.")

    return {"message": "Workout deleted successfully."}


@router.get("/workout-sessions")
def get_workout_sessions(authorization: str | None = Header(default=None)):
    if supabase is None:
        raise HTTPException(status_code=500, detail="Supabase is not configured.")

    user = get_authenticated_user(authorization)

    try:
        result = (
            supabase.table("workout_logs")
            .select("id, exercise_id, log_date, weight, reps, duration_seconds, exercises(name)")
            .eq("user_id", user.id)
            .order("log_date", desc=True)
            .execute()
        )
    except APIError as exc:
        raise HTTPException(status_code=400, detail=f"Failed to load workout sessions: {exc.message}") from exc

    return {"sessions": build_session_summary(result.data or [])}


@router.get("/workout-logs/progress")
def get_workout_progress(
    exercise_id: str,
    authorization: str | None = Header(default=None),
):
    if supabase is None:
        raise HTTPException(status_code=500, detail="Supabase is not configured.")

    user = get_authenticated_user(authorization)

    try:
        exercise_result = (
            supabase.table("exercises")
            .select("name")
            .eq("id", exercise_id)
            .limit(1)
            .execute()
        )
    except APIError as exc:
        raise HTTPException(status_code=400, detail=f"Failed to load exercise: {exc.message}") from exc

    if not exercise_result.data:
        raise HTTPException(status_code=404, detail="Exercise not found.")
    is_cardio = get_exercise_category(exercise_result.data[0].get("name") or "") == "cardio"

    try:
        result = (
            supabase.table("workout_logs")
            .select("log_date, weight, reps, duration_seconds, created_at")
            .eq("user_id", user.id)
            .eq("exercise_id", exercise_id)
            .order("log_date", desc=False)
            .order("created_at", desc=False)
            .execute()
        )
    except APIError as exc:
        raise HTTPException(status_code=400, detail=f"Failed to load workout progress: {exc.message}") from exc

    return {"progress": build_progress_series(result.data or [], is_cardio=is_cardio)}


@router.post("/predictions")
def create_predictions(
    payload: PredictionsPayload,
    authorization: str | None = Header(default=None),
):
    if supabase is None:
        raise HTTPException(status_code=500, detail="Supabase is not configured.")

    user = get_authenticated_user(authorization)

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
                supabase.table("exercises")
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


app.include_router(router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)