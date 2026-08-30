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

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers.health import router as health_router


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
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.is_development else [],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ─────────────────────────────────────────────────────
app.include_router(health_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)

