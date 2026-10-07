import logging
import os

from dotenv import load_dotenv
from fastapi import HTTPException
from supabase import Client, create_client
from supabase_auth.errors import AuthApiError
from supabase_auth.types import User

load_dotenv()

logger = logging.getLogger(__name__)
_admin_client: Client | None = None


def get_supabase_config() -> tuple[str | None, str | None]:
    return os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY")


def get_anon_config() -> tuple[str | None, str | None]:
    return os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_ANON_KEY")


def get_admin_client() -> Client:
    global _admin_client
    supabase_url, service_role_key = get_supabase_config()
    if not supabase_url or not service_role_key:
        raise HTTPException(status_code=500, detail="Supabase is not configured.")
    if _admin_client is None:
        _admin_client = create_client(supabase_url, service_role_key)
    return _admin_client


def get_auth_client() -> Client:
    supabase_url, anon_key = get_anon_config()
    if not supabase_url or not anon_key:
        raise HTTPException(status_code=500, detail="Supabase is not configured.")
    return create_client(supabase_url, anon_key)


def auth_client() -> Client:
    return get_auth_client()


def get_user_context(authorization: str | None) -> tuple[Client, User]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid bearer token.")

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing or invalid bearer token.")

    supabase_url, anon_key = get_anon_config()
    if not supabase_url or not anon_key:
        raise HTTPException(status_code=500, detail="Supabase is not configured.")

    client = create_client(supabase_url, anon_key)
    try:
        response = client.auth.get_user(token)
    except AuthApiError as exc:
        raise HTTPException(status_code=401, detail=exc.message) from exc
    except Exception as exc:
        logger.warning("Token verification failed: %s", exc)
        raise HTTPException(status_code=401, detail="Invalid or expired token.") from exc

    user = getattr(response, "user", None) if response else None
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    client.postgrest.auth(token)
    return client, user


def get_authenticated_user(authorization: str | None) -> User:
    return get_user_context(authorization)[1]


def is_supabase_configured() -> bool:
    url, anon_key = get_anon_config()
    _, service_role_key = get_supabase_config()
    return bool(url and anon_key and service_role_key)


__all__ = [
    "auth_client",
    "get_admin_client",
    "get_anon_config",
    "get_authenticated_user",
    "get_auth_client",
    "get_supabase_config",
    "get_user_context",
    "is_supabase_configured",
]
