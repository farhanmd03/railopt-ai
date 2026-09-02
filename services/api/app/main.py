"""FastAPI application entry point for the RailOpt AI API.

Run from the project root:

    uvicorn app.main:app --app-dir services/api --reload

Or from services/api/:

    uvicorn app.main:app --reload
"""

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
import sys

if sys.platform == "win32":
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    except Exception:
        pass

import json
import os

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers.assets import router as assets_router
from app.routers.auth import router as auth_router
from app.routers.audit import router as audit_router
from app.routers.candidate_blocks import router as candidate_blocks_router
from app.routers.explanations import router as explanations_router
from app.routers.health import router as health_router
from app.routers.maintenance import router as maintenance_router
from app.routers.optimization import router as optimization_router
from app.routers.scenarios import router as scenarios_router
from app.routers.sections import router as sections_router
from app.routers.stations import router as stations_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan handler — startup and shutdown logic."""
    # ── Startup ──────────────────────────────────────────────────
    yield
    # ── Shutdown ─────────────────────────────────────────────────
    from app.core.database import engine

    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    description=(
        "AI-Powered Multi-Department Railway Maintenance "
        "Block Planning & Optimization"
    ),
    version="0.1.0",
    lifespan=lifespan,
)

# ── Middleware ───────────────────────────────────────────────────
if settings.is_development:
    cors_allow_origins = ["*"]
else:
    cors_allow_origins = [
        "https://railopt-ai-five.vercel.app",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    # Ingest additional origins from environment if configured
    cors_env = os.environ.get("CORS_ORIGINS", "").strip()
    if cors_env:
        try:
            parsed = json.loads(cors_env)
            if isinstance(parsed, list):
                for origin in parsed:
                    if origin not in cors_allow_origins:
                        cors_allow_origins.append(origin)
        except Exception:
            for origin in cors_env.split(","):
                cleaned = origin.strip()
                if cleaned and cleaned not in cors_allow_origins:
                    cors_allow_origins.append(cleaned)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ─────────────────────────────────────────────────────
app.include_router(health_router)

# ── API v1 Router ────────────────────────────────────────────────
api_v1_router = APIRouter(prefix="/api/v1")
api_v1_router.include_router(sections_router)
api_v1_router.include_router(auth_router)
api_v1_router.include_router(stations_router)
api_v1_router.include_router(assets_router)
api_v1_router.include_router(maintenance_router)
api_v1_router.include_router(candidate_blocks_router)
api_v1_router.include_router(optimization_router)
api_v1_router.include_router(scenarios_router)
api_v1_router.include_router(audit_router)
api_v1_router.include_router(explanations_router)

app.include_router(api_v1_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)

