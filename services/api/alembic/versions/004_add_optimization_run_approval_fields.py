"""004_add_optimization_run_approval_fields

Revision ID: 004_add_optimization_run_approval_fields
Revises: 003_widen_varchar_columns
Create Date: 2026-08-31 22:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '004_approval_workflow'
down_revision: Union[str, None] = '003_widen_varchar_columns'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'optimization_runs',
        sa.Column('approval_status', sa.String(length=50), nullable=False, server_default='DRAFT')
    )
    op.add_column(
        'optimization_runs',
        sa.Column('submitted_by', sa.String(length=100), nullable=True)
    )
    op.add_column(
        'optimization_runs',
        sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        'optimization_runs',
        sa.Column('approved_by', sa.String(length=100), nullable=True)
    )
    op.add_column(
        'optimization_runs',
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        'optimization_runs',
        sa.Column('rejected_by', sa.String(length=100), nullable=True)
    )
    op.add_column(
        'optimization_runs',
        sa.Column('rejected_at', sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        'optimization_runs',
        sa.Column('rejection_reason', sa.Text(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('optimization_runs', 'rejection_reason')
    op.drop_column('optimization_runs', 'rejected_at')
    op.drop_column('optimization_runs', 'rejected_by')
    op.drop_column('optimization_runs', 'approved_at')
    op.drop_column('optimization_runs', 'approved_by')
    op.drop_column('optimization_runs', 'submitted_at')
    op.drop_column('optimization_runs', 'submitted_by')
    op.drop_column('optimization_runs', 'approval_status')
