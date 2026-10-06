import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers.auth import router as auth_router
from .routers.exercises import router as exercises_router
from .routers.forecast import router as forecast_router
from .routers.sessions import router as sessions_router
from .routers.workouts import router as workouts_router

app = FastAPI(title="Workout Tracker API")

LOCAL_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]


def get_cors_origins() -> list[str]:
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

for feature_router in (
    auth_router,
    exercises_router,
    workouts_router,
    sessions_router,
    forecast_router,
):
    app.include_router(feature_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("back.main:app", host="127.0.0.1", port=8000, reload=True)
