"""Alembic environment configuration.

Uses a **synchronous** ``create_engine`` for migrations because Alembic's
migration runner is synchronous.  The ``postgresql+psycopg`` dialect
works with both sync and async engines (psycopg v3).
"""

import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import create_engine, pool

# ── Ensure the API package is importable ─────────────────────────
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import settings  # noqa: E402
from app.models import Base  # noqa: E402  — imports all models for metadata

# ── Alembic Config ───────────────────────────────────────────────
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# PostGIS creates tables in tiger, tiger_data, topology schemas,
# and also system tables like spatial_ref_sys in public.
# Exclude all of these from Alembic's autogenerate diff.
EXCLUDE_TABLES = frozenset({
    "spatial_ref_sys",  # PostGIS core
    "topology",         # PostGIS topology
    "layer",            # PostGIS topology
})


def include_object(
    object,  # noqa: A002
    name: str | None,
    type_: str,
    reflected: bool,
    compare_to: object | None,
) -> bool:
    """Filter out PostGIS internal objects from autogenerate."""
    if type_ == "table":
        # Exclude tables not in our metadata and any known PostGIS tables
        if reflected and name not in target_metadata.tables:
            return False
        if name in EXCLUDE_TABLES:
            return False
    return True


def run_migrations_offline() -> None:
    """Generate SQL without a live database connection."""
    context.configure(
        url=settings.database_url,
        target_metadata=target_metadata,
        include_object=include_object,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations against a live database."""
    connectable = create_engine(
        settings.database_url,
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_object=include_object,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
