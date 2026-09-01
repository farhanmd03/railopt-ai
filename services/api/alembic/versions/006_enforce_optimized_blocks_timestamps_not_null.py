"""enforce optimized_blocks timestamps not null and check constraint

Revision ID: 006_block_timestamps_not_null
Revises: 005_what_if_scenarios
Create Date: 2026-09-01 15:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "006_block_timestamps_not_null"
down_revision: Union[str, None] = "005_what_if_scenarios"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Enforce NOT NULL on block_start and block_end
    op.alter_column(
        "optimized_blocks",
        "block_start",
        existing_type=sa.DateTime(timezone=True),
        nullable=False,
    )
    op.alter_column(
        "optimized_blocks",
        "block_end",
        existing_type=sa.DateTime(timezone=True),
        nullable=False,
    )

    # 2. Add CheckConstraint to ensure block_start < block_end
    op.create_check_constraint(
        "ck_optimized_blocks_start_before_end",
        "optimized_blocks",
        "block_start < block_end",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_optimized_blocks_start_before_end",
        "optimized_blocks",
        type_="check",
    )
    op.alter_column(
        "optimized_blocks",
        "block_end",
        existing_type=sa.DateTime(timezone=True),
        nullable=True,
    )
    op.alter_column(
        "optimized_blocks",
        "block_start",
        existing_type=sa.DateTime(timezone=True),
        nullable=True,
    )
