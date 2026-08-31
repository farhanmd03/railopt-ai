"""add optimization_scenarios table

Revision ID: 005_what_if_scenarios
Revises: 004_approval_workflow
Create Date: 2026-08-31 22:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "005_what_if_scenarios"
down_revision: Union[str, None] = "004_approval_workflow"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "optimization_scenarios",
        sa.Column("id", sa.Integer(), nullable=False, primary_key=True),
        sa.Column("scenario_id", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("scenario_type", sa.String(length=50), nullable=False, server_default="OBJECTIVE_WEIGHTS"),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="SCENARIO_CREATED"),
        sa.Column("base_run_id", sa.Integer(), sa.ForeignKey("optimization_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("scenario_run_id", sa.Integer(), sa.ForeignKey("optimization_runs.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_by", sa.String(length=100), nullable=True),
        sa.Column("parameters", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_optimization_scenarios_scenario_id", "optimization_scenarios", ["scenario_id"], unique=True)
    op.create_index("ix_optimization_scenarios_base_run_id", "optimization_scenarios", ["base_run_id"])
    op.create_index("ix_optimization_scenarios_scenario_run_id", "optimization_scenarios", ["scenario_run_id"])


def downgrade() -> None:
    op.drop_index("ix_optimization_scenarios_scenario_run_id", table_name="optimization_scenarios")
    op.drop_index("ix_optimization_scenarios_base_run_id", table_name="optimization_scenarios")
    op.drop_index("ix_optimization_scenarios_scenario_id", table_name="optimization_scenarios")
    op.drop_table("optimization_scenarios")
