import logging
import os
import re
import time

from fastapi import APIRouter, Header, HTTPException, Request
from postgrest.exceptions import APIError
from supabase_auth.errors import AuthApiError

from ..data_access import (
    auth_client as create_auth_client,
    get_admin_client,
    get_user_context,
    is_supabase_configured,
)
from ..schemas import (
    DeleteAccountPayload,
    LoginPayload,
    RefreshPayload,
    RegisterPayload,
    UpdatePasswordPayload,
    UpdateUsernamePayload,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")
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


@router.get("/health")
def health_status():
    return {
        "status": "ok",
        "supabase_connected": is_supabase_configured(),
    }


@router.post("/auth/register")
def register_user(payload: RegisterPayload, request: Request):
    client = get_admin_client()

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
            client.table("profiles")
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
    auth_client = create_auth_client()
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
            client.table("profiles").upsert(
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
                client.auth.admin.delete_user(auth_response.user.id)
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
    client = get_admin_client()

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
                client.table("profiles")
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
    auth_client = create_auth_client()
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
    if not is_supabase_configured():
        raise HTTPException(status_code=500, detail="Supabase is not configured.")

    # Same reasoning as login/register: use a throwaway client so the
    # refreshed session never contaminates the shared admin client.
    auth_client = create_auth_client()
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
    _, user = get_user_context(authorization)
    return {"user": user}


@router.patch("/profile/username")
def update_username(
    payload: UpdateUsernamePayload,
    authorization: str | None = Header(default=None),
):
    user_client, user = get_user_context(authorization)
    admin_client = get_admin_client()

    try:
        new_username = normalize_username(payload.username)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # Check if username already exists
    try:
        existing_user = (
            admin_client.table("profiles")
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
        user_client.table("profiles").update(
            {"username": new_username}
        ).eq("id", user.id).execute()
    except APIError as exc:
        raise HTTPException(status_code=400, detail=f"Failed to update username: {exc.message}") from exc

    # Update user metadata in auth via admin client
    try:
        admin_client.auth.admin.update_user_by_id(
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
    _, user = get_user_context(authorization)
    client = get_admin_client()

    if len(payload.new_password or "") < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters long.")

    # Verify current password by attempting login
    user_email = user.email
    try:
        auth_client = create_auth_client()
        # Try to sign in with current password to verify it
        auth_client.auth.sign_in_with_password(
            {"email": user_email, "password": payload.current_password}
        )
    except AuthApiError as exc:
        raise HTTPException(status_code=401, detail="Current password is incorrect.") from exc

    # Update password using admin API
    try:
        client.auth.admin.update_user_by_id(
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
    user_client, user = get_user_context(authorization)
    admin_client = get_admin_client()

    # Verify password
    user_email = user.email
    try:
        auth_client = create_auth_client()
        auth_client.auth.sign_in_with_password(
            {"email": user_email, "password": payload.password}
        )
    except AuthApiError as exc:
        raise HTTPException(status_code=401, detail="Password is incorrect.") from exc

    profile_snapshot = None
    try:
        existing_profile = (
            user_client.table("profiles")
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
        user_client.table("profiles").delete().eq("id", user.id).execute()
    except APIError as exc:
        raise HTTPException(status_code=400, detail=f"Failed to delete profile: {exc.message}") from exc

    # Delete user from auth (admin operation using service role key). If the auth
    # deletion fails after we already removed the profile row, restore the profile
    # so the user data is not lost unexpectedly.
    try:
        admin_client.auth.admin.delete_user(user.id)
    except Exception as exc:
        logger.exception("Auth user deletion failed")
        if profile_snapshot:
            try:
                admin_client.table("profiles").upsert(profile_snapshot, on_conflict="id").execute()
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
