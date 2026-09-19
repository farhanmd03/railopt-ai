"""add department_messages table

Revision ID: 010_add_department_messages
Revises: 009_add_possession_outcomes
Create Date: 2026-09-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "010_add_department_messages"
down_revision: Union[str, None] = "009_add_possession_outcomes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "department_messages",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "optimized_block_id",
            sa.Integer(),
            sa.ForeignKey("optimized_blocks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("department", sa.String(length=100), nullable=False),
        sa.Column("actor", sa.String(length=100), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("message_type", sa.String(length=50), server_default="CHAT", nullable=True),
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
        "ix_department_messages_optimized_block_id",
        "department_messages",
        ["optimized_block_id"],
    )
    op.create_index(
        "ix_department_messages_timestamp",
        "department_messages",
        ["timestamp"],
    )


def downgrade() -> None:
    op.drop_index("ix_department_messages_timestamp", table_name="department_messages")
    op.drop_index("ix_department_messages_optimized_block_id", table_name="department_messages")
    op.drop_table("department_messages")
