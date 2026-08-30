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

engine = create_async_engine(
    settings.database_url,
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
