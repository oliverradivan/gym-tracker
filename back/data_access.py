import logging
import os
from typing import Optional

from dotenv import load_dotenv
from fastapi import HTTPException
from supabase import Client, create_client
from supabase_auth.errors import AuthApiError

load_dotenv()

logger = logging.getLogger(__name__)


def get_supabase_config() -> tuple[str | None, str | None]:
    return os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY")


# This is the ONLY client used for table operations (profiles, etc). Auth
# operations that create or update sessions must use a throwaway client.
supabase: Optional[Client] = None
_supabase_url, _supabase_key = get_supabase_config()
if _supabase_url and _supabase_key:
    supabase = create_client(_supabase_url, _supabase_key)
def get_supabase() -> Optional[Client]:
    return supabase


def get_auth_client() -> Client:
    supabase_url, supabase_key = get_supabase_config()
    if not supabase_url or not supabase_key:
        raise HTTPException(status_code=500, detail="Supabase is not configured.")
    return create_client(supabase_url, supabase_key)


def auth_client() -> Client:
    return get_auth_client()


def _verify_authenticated_user(authorization: str | None):
    client = get_supabase()
    if client is None:
        raise HTTPException(status_code=500, detail="Supabase is not configured.")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid bearer token.")

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing or invalid bearer token.")

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
    return user


def get_authenticated_user(authorization: str | None):
    return _verify_authenticated_user(authorization)


__all__ = [
    "AuthApiError",
    "auth_client",
    "get_authenticated_user",
    "get_auth_client",
    "get_supabase",
    "get_supabase_config",
    "supabase",
]
