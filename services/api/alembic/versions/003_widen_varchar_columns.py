"""003_widen_varchar_columns

Revision ID: 003_widen_varchar_columns
Revises: 002_batch_1_review_fixes
Create Date: 2026-08-30 13:42:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '003_widen_varchar_columns'
down_revision: Union[str, None] = '002_batch_1_review_fixes'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        'section_station_map',
        'relationship_type',
        existing_type=sa.VARCHAR(length=50),
        type_=sa.VARCHAR(length=200),
        existing_nullable=True,
    )
    op.alter_column(
        'train_section_occupancy',
        'direction',
        existing_type=sa.VARCHAR(length=10),
        type_=sa.VARCHAR(length=50),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        'train_section_occupancy',
        'direction',
        existing_type=sa.VARCHAR(length=50),
        type_=sa.VARCHAR(length=10),
        existing_nullable=True,
    )
    op.alter_column(
        'section_station_map',
        'relationship_type',
        existing_type=sa.VARCHAR(length=200),
        type_=sa.VARCHAR(length=50),
        existing_nullable=True,
    )
