"""add negotiation_logs table

Revision ID: 007_add_negotiation_logs
Revises: 006_block_timestamps_not_null
Create Date: 2026-09-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "007_add_negotiation_logs"
down_revision: Union[str, None] = "006_block_timestamps_not_null"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create enum types if PostgreSQL or use String/native enum
    negotiation_action_enum = sa.Enum(
        "ACCEPT",
        "ADJUST",
        "REJECT",
        name="negotiationaction",
    )
    adjustment_category_enum = sa.Enum(
        "TIME_CHANGE",
        "DURATION_CHANGE",
        "RESOURCE_CONCERN",
        "TRAIN_CONFLICT",
        "READINESS_CONCERN",
        "OTHER",
        name="adjustmentcategory",
    )

    op.create_table(
        "negotiation_logs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "optimized_block_id",
            sa.Integer(),
            sa.ForeignKey("optimized_blocks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("department", sa.String(length=100), nullable=False),
        sa.Column("action", negotiation_action_enum, nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("adjustment_category", adjustment_category_enum, nullable=True),
        sa.Column("adjustment_payload", sa.JSON(), nullable=True),
        sa.Column("performed_by", sa.String(length=100), nullable=False),
        sa.Column(
            "timestamp",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
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
        "ix_negotiation_logs_optimized_block_id",
        "negotiation_logs",
        ["optimized_block_id"],
    )
    op.create_index(
        "ix_negotiation_logs_timestamp",
        "negotiation_logs",
        ["timestamp"],
    )


def downgrade() -> None:
    op.drop_index("ix_negotiation_logs_timestamp", table_name="negotiation_logs")
    op.drop_index("ix_negotiation_logs_optimized_block_id", table_name="negotiation_logs")
    op.drop_table("negotiation_logs")

    # Drop enums if postgresql
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        sa.Enum(name="adjustmentcategory").drop(bind, checkfirst=True)
        sa.Enum(name="negotiationaction").drop(bind, checkfirst=True)
