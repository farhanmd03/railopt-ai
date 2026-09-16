"""add possession outcomes table

Revision ID: 009_add_possession_outcomes
Revises: 008_add_notifications
Create Date: 2026-09-17 01:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "009_add_possession_outcomes"
down_revision: Union[str, None] = "008_add_notifications"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create enum type for PossessionOutcomeStatus
    possession_outcome_status_enum = sa.Enum(
        "PLANNED",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
        "DELAYED",
        name="possessionoutcomestatus",
    )

    op.create_table(
        "possession_outcomes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "optimized_block_id",
            sa.Integer(),
            sa.ForeignKey("optimized_blocks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("planned_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("planned_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("actual_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("actual_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", possession_outcome_status_enum, server_default="PLANNED", nullable=False),
        sa.Column("delay_minutes", sa.Integer(), nullable=True),
        sa.Column("cancellation_reason", sa.Text(), nullable=True),
        sa.Column("affected_departments", sa.JSON(), nullable=True),
        sa.Column("planned_impact_score", sa.Float(), nullable=True),
        sa.Column("actual_impact_score", sa.Float(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("recorded_by", sa.String(length=100), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_index(
        "ix_possession_outcomes_optimized_block_id",
        "possession_outcomes",
        ["optimized_block_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_possession_outcomes_optimized_block_id", table_name="possession_outcomes")
    op.drop_table("possession_outcomes")

    # Drop enum if postgresql
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        sa.Enum(name="possessionoutcomestatus").drop(bind, checkfirst=True)