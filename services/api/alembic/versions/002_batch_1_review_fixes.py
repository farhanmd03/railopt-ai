"""002_batch_1_review_fixes

Revision ID: 002_batch_1_review_fixes
Revises: 001_initial_schema
Create Date: 2026-08-30 13:26:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '002_batch_1_review_fixes'
down_revision: Union[str, None] = '001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Composite uniqueness constraints on task junction tables
    op.create_unique_constraint(
        'uq_block_request_task',
        'block_request_tasks',
        ['request_id', 'task_id'],
    )
    op.create_unique_constraint(
        'uq_optimized_block_task',
        'optimized_block_tasks',
        ['optimized_block_id', 'task_id'],
    )

    # 2. Foreign keys for TrainRun station codes referencing stations.station_code
    op.create_foreign_key(
        'fk_train_runs_from_station_code_stations',
        'train_runs',
        'stations',
        ['from_station_code'],
        ['station_code'],
    )
    op.create_foreign_key(
        'fk_train_runs_to_station_code_stations',
        'train_runs',
        'stations',
        ['to_station_code'],
        ['station_code'],
    )


def downgrade() -> None:
    op.drop_constraint(
        'fk_train_runs_to_station_code_stations',
        'train_runs',
        type_='foreignkey',
    )
    op.drop_constraint(
        'fk_train_runs_from_station_code_stations',
        'train_runs',
        type_='foreignkey',
    )
    op.drop_constraint(
        'uq_optimized_block_task',
        'optimized_block_tasks',
        type_='unique',
    )
    op.drop_constraint(
        'uq_block_request_task',
        'block_request_tasks',
        type_='unique',
    )
