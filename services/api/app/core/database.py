"""SQLAlchemy async engine and session configuration.

Uses psycopg (v3) which natively supports both sync and async.
The ``postgresql+psycopg`` dialect works with ``create_async_engine``
because psycopg 3 automatically uses its async mode when the engine type
requires it.
"""

import asyncio
from collections.abc import AsyncGenerator
import sys

if sys.platform == "win32":
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    except Exception:
        pass

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings


def normalize_database_url(url: str) -> str:
    """Normalize PostgreSQL connection string for SQLAlchemy async engine.

    Ensures plain 'postgresql://' or 'postgres://' connection strings from cloud hosts
    (e.g., Supabase Session Pooler on port 5432, Render, RDS) route to the installed
    psycopg v3 async driver ('postgresql+psycopg://'), preventing SQLAlchemy from
    attempting to load missing 'psycopg2'.
    """
    if not url:
        return url
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url[len("postgres://"):]
    if url.startswith("postgresql://") and not url.startswith("postgresql+"):
        return "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


engine = create_async_engine(
    normalize_database_url(settings.database_url),
    echo=settings.is_development,
    pool_pre_ping=True,
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields an async database session.

    The session is automatically closed when the request finishes.
    Callers are responsible for calling ``await session.commit()``
    when writes are intended.
    """
    async with async_session_factory() as session:
        yield session
