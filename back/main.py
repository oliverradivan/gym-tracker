import os
import re
import time
from typing import Optional, List

from datetime import datetime, timedelta

from dateutil import parser as dateutil_parser

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, Body, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from postgrest.exceptions import APIError
from pydantic import BaseModel
from supabase import Client, create_client
from supabase_auth.errors import AuthApiError


class PredictionsPayload(BaseModel):
    points: list[dict[str, str | float | int]]
    periods: int = 7

load_dotenv()

def get_supabase_config() -> tuple[str | None, str | None]:
    return os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY")


SUPABASE_URL, SUPABASE_KEY = get_supabase_config()

app = FastAPI(title="Workout Tracker API")
router = APIRouter(prefix="/api")

if os.getenv("APP_ENV") == "local":
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ],
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


def check_rate_limit(identifier: str, max_requests: int = 5, window_seconds: int = 60) -> None:
    now = time.time()
    bucket = RATE_LIMIT_BUCKETS.setdefault(identifier, [])
    bucket[:] = [timestamp for timestamp in bucket if now - timestamp < window_seconds]

    if len(bucket) >= max_requests:
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please wait a moment and try again.",
        )

    bucket.append(now)


def get_client_ip(request: Request) -> str:
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
    weight: float
    reps: float


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


def build_progress_series(rows):
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

        weight = float(row.get("weight") or 0)
        reps = int(row.get("reps") or 0)
        volume = weight * reps
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
                "weight": weight,
                "reps": reps,
                "volume": volume,
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


def build_forecast(points: list[dict], periods: int = 7) -> list[dict]:
    if not points:
        return []

    sorted_points = sorted(points, key=lambda item: str(item.get("date", "")))
    values = [float(point.get("volume", 0) or 0) for point in sorted_points]
    if len(values) < 2:
        return []

    slope = (values[-1] - values[0]) / max(len(values) - 1, 1)
    start_date = datetime.strptime(str(sorted_points[-1].get("date")), "%Y-%m-%d")
    forecast = []

    for offset in range(1, max(1, periods) + 1):
        projected = values[-1] + (slope * offset)
        next_date = start_date + timedelta(days=offset)
        forecast.append(
            {
                "date": next_date.strftime("%Y-%m-%d"),
                "value": round(projected, 2),
                "lower": round(max(projected * 0.9, 0), 2),
                "upper": round(projected * 1.1, 2),
            }
        )

    return forecast


def get_authenticated_user(authorization: str | None):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid bearer token.")

    token = authorization.split(" ", 1)[1]
    try:
        user = supabase.auth.get_user(token)
        return user.user
    except AuthApiError as exc:
        raise HTTPException(status_code=401, detail=exc.message) from exc


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
                raise HTTPException(status_code=401, detail="Invalid email or password.")
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
        raise HTTPException(status_code=401, detail="Invalid email or password.") from exc

    return {
        "message": "Login successful.",
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

    # Update user metadata in auth
    try:
        auth_client = get_auth_client()
        auth_client.auth.update_user(
            user.session.access_token if hasattr(user, 'session') else None,
            {"user_metadata": {"username": new_username, "full_name": new_username}},
        )
    except Exception as exc:
        # Log but don't fail if auth metadata update fails
        print(f"Warning: Failed to update auth metadata: {exc}")

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

    # Update password
    try:
        auth_client = get_auth_client()
        auth_client.auth.update_user(
            {"password": payload.new_password},
        )
    except AuthApiError as exc:
        raise HTTPException(status_code=400, detail=f"Failed to update password: {exc.message}") from exc

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
        if profile_snapshot:
            try:
                supabase.table("profiles").upsert(profile_snapshot, on_conflict="id").execute()
            except APIError as restore_exc:
                raise HTTPException(
                    status_code=500,
                    detail=(
                        "Failed to delete account: auth deletion failed and profile recovery also failed. "
                        f"Original error: {exc}. Recovery error: {restore_exc.message}"
                    ),
                ) from exc

        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to delete account: auth deletion failed and the profile was restored. "
                f"Original error: {exc}"
            ),
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
        existing = (
            supabase.table("exercises")
            .select("*")
            .ilike("name", name)
            .limit(1)
            .execute()
        )
        if existing.data:
            return {"exercise": existing.data[0], "created": False}
    except APIError as exc:
        raise HTTPException(status_code=400, detail=f"Failed to check exercise name: {exc.message}") from exc

    try:
        created = (
            supabase.table("exercises")
            .insert({"name": name})
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

    user = get_authenticated_user(authorization)

    raise HTTPException(status_code=403, detail="Exercise updates are not allowed. Exercises are managed globally.")


@router.delete("/exercises/{exercise_id}")
def delete_exercise(
    exercise_id: str,
    authorization: str | None = Header(default=None),
):
    if supabase is None:
        raise HTTPException(status_code=500, detail="Supabase is not configured.")

    user = get_authenticated_user(authorization)

    raise HTTPException(status_code=403, detail="Exercise deletions are not allowed. Exercises are managed globally.")


@router.post("/workout-logs")
def create_workout_log(
    payload: WorkoutLogPayload,
    authorization: str | None = Header(default=None),
):
    if supabase is None:
        raise HTTPException(status_code=500, detail="Supabase is not configured.")

    user = get_authenticated_user(authorization)

    if payload.weight < 0:
        raise HTTPException(status_code=400, detail="Weight must be zero or greater.")
    if payload.reps <= 0:
        raise HTTPException(status_code=400, detail="Reps must be greater than zero.")

    try:
        existing_exercise = (
            supabase.table("exercises")
            .select("id")
            .eq("id", payload.exercise_id)
            .limit(1)
            .execute()
        )
        if not existing_exercise.data:
            raise HTTPException(status_code=404, detail="Exercise not found.")
    except APIError as exc:
        raise HTTPException(status_code=400, detail=f"Exercise validation failed: {exc.message}") from exc

    try:
        created = (
            supabase.table("workout_logs")
            .insert(
                {
                    "user_id": user.id,
                    "exercise_id": payload.exercise_id,
                    "log_date": payload.log_date,
                    "weight": payload.weight,
                    "reps": payload.reps,
                    "set_number": 1,
                }
            )
            .execute()
        )
    except APIError as exc:
        raise HTTPException(status_code=400, detail=f"Failed to save workout log: {exc.message}") from exc

    return {"message": "good job gabby!", "log": created.data[0] if created.data else None}


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
            .select("id, exercise_id, log_date, weight, reps, exercises(name)")
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
        result = (
            supabase.table("workout_logs")
            .select("log_date, weight, reps")
            .eq("user_id", user.id)
            .eq("exercise_id", exercise_id)
            .order("log_date", desc=False)
            .execute()
        )
    except APIError as exc:
        raise HTTPException(status_code=400, detail=f"Failed to load workout progress: {exc.message}") from exc

    return {"progress": build_progress_series(result.data or [])}


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

    periods = max(1, payload.periods)
    predictions = build_forecast(points, periods=periods)
    return {"predictions": predictions}


app.include_router(router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)