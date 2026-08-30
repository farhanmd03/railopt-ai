"""001_initial_schema

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-08-30 13:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Safely enable PostGIS extension first
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis;")

    op.create_table('audit_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('user_id', sa.String(length=100), nullable=True),
        sa.Column('action', sa.String(length=100), nullable=False),
        sa.Column('entity_type', sa.String(length=100), nullable=True),
        sa.Column('entity_id', sa.String(length=100), nullable=True),
        sa.Column('before_value', sa.Text(), nullable=True),
        sa.Column('after_value', sa.Text(), nullable=True),
        sa.Column('details', sa.Text(), nullable=True),
        sa.Column('ip_address', sa.String(length=50), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_audit_logs_action'), 'audit_logs', ['action'], unique=False)
    op.create_index(op.f('ix_audit_logs_timestamp'), 'audit_logs', ['timestamp'], unique=False)
    op.create_index(op.f('ix_audit_logs_user_id'), 'audit_logs', ['user_id'], unique=False)

    op.create_table('divisions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('division_name', sa.String(length=100), nullable=False),
        sa.Column('zone', sa.String(length=100), nullable=False),
        sa.Column('total_route_km', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('total_stations', sa.Integer(), nullable=True),
        sa.Column('total_block_stations', sa.Integer(), nullable=True),
        sa.Column('source', sa.String(length=200), nullable=True),
        sa.Column('source_type', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('division_name')
    )

    op.create_table('optimization_runs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('run_type', sa.String(length=50), nullable=True),
        sa.Column('planning_horizon_start', sa.DateTime(timezone=True), nullable=True),
        sa.Column('planning_horizon_end', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=True),
        sa.Column('solver_status', sa.String(length=50), nullable=True),
        sa.Column('objective_value', sa.Float(), nullable=True),
        sa.Column('solve_time_seconds', sa.Float(), nullable=True),
        sa.Column('parameters', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('resources',
        sa.Column('resource_id', sa.String(length=50), nullable=False),
        sa.Column('resource_type', sa.String(length=100), nullable=True),
        sa.Column('depot', sa.String(length=100), nullable=True),
        sa.Column('travel_speed_kmph', sa.Float(), nullable=True),
        sa.Column('availability_window', sa.String(length=100), nullable=True),
        sa.Column('department', sa.String(length=50), nullable=False),
        sa.Column('availability_from', sa.Time(), nullable=True),
        sa.Column('availability_to', sa.Time(), nullable=True),
        sa.Column('team_size', sa.Integer(), nullable=True),
        sa.Column('required_skill', sa.String(length=200), nullable=True),
        sa.Column('equipment', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=True),
        sa.Column('source_type', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('resource_id')
    )
    op.create_index(op.f('ix_resources_department'), 'resources', ['department'], unique=False)

    op.create_table('stations',
        sa.Column('station_code', sa.String(length=20), nullable=False),
        sa.Column('station_name', sa.String(length=200), nullable=False),
        sa.Column('station_type', sa.String(length=50), nullable=True),
        sa.Column('block_station', sa.Boolean(), nullable=True),
        sa.Column('ibp', sa.Boolean(), nullable=True),
        sa.Column('flag_station', sa.Boolean(), nullable=True),
        sa.Column('halt', sa.Boolean(), nullable=True),
        sa.Column('platform_available', sa.Boolean(), nullable=True),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('division', sa.String(length=100), nullable=True),
        sa.Column('zone', sa.String(length=100), nullable=True),
        sa.Column('out_of_division_station', sa.Boolean(), nullable=True),
        sa.Column('administrative_division', sa.String(length=100), nullable=True),
        sa.Column('scope_note', sa.Text(), nullable=True),
        sa.Column('source_type', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('station_code')
    )
    op.create_index('ix_stations_division', 'stations', ['division'], unique=False)

    op.create_table('system_settings',
        sa.Column('key', sa.String(length=200), nullable=False),
        sa.Column('value', sa.Text(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('key')
    )

    op.create_table('resource_availability',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('resource_id', sa.String(length=50), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('available_from', sa.Time(), nullable=True),
        sa.Column('available_to', sa.Time(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['resource_id'], ['resources.resource_id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_resource_availability_resource_id'), 'resource_availability', ['resource_id'], unique=False)

    op.create_table('sections',
        sa.Column('section_id', sa.String(length=50), nullable=False),
        sa.Column('section_name', sa.String(length=200), nullable=False),
        sa.Column('from_station_code', sa.String(length=20), nullable=True),
        sa.Column('to_station_code', sa.String(length=20), nullable=True),
        sa.Column('route_km', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('track_count', sa.Integer(), nullable=True),
        sa.Column('line_type', sa.String(length=50), nullable=True),
        sa.Column('electrified', sa.Boolean(), nullable=True),
        sa.Column('signalling_system', sa.String(length=100), nullable=True),
        sa.Column('division_id', sa.Integer(), nullable=True),
        sa.Column('source', sa.String(length=200), nullable=True),
        sa.Column('source_type', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['division_id'], ['divisions.id'], ),
        sa.ForeignKeyConstraint(['from_station_code'], ['stations.station_code'], ),
        sa.ForeignKeyConstraint(['to_station_code'], ['stations.station_code'], ),
        sa.PrimaryKeyConstraint('section_id')
    )

    op.create_table('assets',
        sa.Column('asset_id', sa.String(length=50), nullable=False),
        sa.Column('section_id', sa.String(length=50), nullable=True),
        sa.Column('station_code', sa.String(length=20), nullable=True),
        sa.Column('department', sa.String(length=50), nullable=False),
        sa.Column('asset_type', sa.String(length=50), nullable=False),
        sa.Column('failure_risk_score', sa.Float(), nullable=True),
        sa.Column('criticality_index', sa.Float(), nullable=True),
        sa.Column('last_maintained_date', sa.Date(), nullable=True),
        sa.Column('source_type', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['section_id'], ['sections.section_id'], ),
        sa.ForeignKeyConstraint(['station_code'], ['stations.station_code'], ),
        sa.PrimaryKeyConstraint('asset_id')
    )
    op.create_index(op.f('ix_assets_asset_type'), 'assets', ['asset_type'], unique=False)
    op.create_index(op.f('ix_assets_department'), 'assets', ['department'], unique=False)
    op.create_index(op.f('ix_assets_section_id'), 'assets', ['section_id'], unique=False)

    op.create_table('block_requests',
        sa.Column('request_id', sa.String(length=50), nullable=False),
        sa.Column('department', sa.String(length=50), nullable=False),
        sa.Column('section_id', sa.String(length=50), nullable=True),
        sa.Column('requested_start', sa.DateTime(timezone=True), nullable=True),
        sa.Column('requested_duration_hrs', sa.Numeric(precision=6, scale=2), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['section_id'], ['sections.section_id'], ),
        sa.PrimaryKeyConstraint('request_id')
    )
    op.create_index(op.f('ix_block_requests_department'), 'block_requests', ['department'], unique=False)
    op.create_index(op.f('ix_block_requests_section_id'), 'block_requests', ['section_id'], unique=False)

    op.create_table('corridor_windows',
        sa.Column('window_id', sa.String(length=50), nullable=False),
        sa.Column('section_id', sa.String(length=50), nullable=True),
        sa.Column('window_start', sa.DateTime(timezone=True), nullable=True),
        sa.Column('window_end', sa.DateTime(timezone=True), nullable=True),
        sa.Column('duration_mins', sa.Integer(), nullable=True),
        sa.Column('window_type', sa.String(length=50), nullable=True),
        sa.Column('window_status', sa.String(length=50), nullable=True),
        sa.Column('freight_level', sa.String(length=50), nullable=True),
        sa.Column('source_type', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['section_id'], ['sections.section_id'], ),
        sa.PrimaryKeyConstraint('window_id')
    )
    op.create_index(op.f('ix_corridor_windows_section_id'), 'corridor_windows', ['section_id'], unique=False)

    op.create_table('freight_forecasts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('section_id', sa.String(length=50), nullable=True),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('forecast_freight_trains', sa.Integer(), nullable=True),
        sa.Column('forecast_tonnage', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column('source_type', sa.String(length=50), nullable=True),
        sa.Column('forecast_confidence', sa.Float(), nullable=True),
        sa.Column('traffic_level', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['section_id'], ['sections.section_id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('section_id', 'date', name='uq_freight_forecast_section_date')
    )
    op.create_index(op.f('ix_freight_forecasts_date'), 'freight_forecasts', ['date'], unique=False)
    op.create_index(op.f('ix_freight_forecasts_section_id'), 'freight_forecasts', ['section_id'], unique=False)

    op.create_table('operational_subsections',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('section_id', sa.String(length=50), nullable=False),
        sa.Column('subsection_name', sa.String(length=200), nullable=False),
        sa.Column('from_km', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('to_km', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['section_id'], ['sections.section_id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_operational_subsections_section_id'), 'operational_subsections', ['section_id'], unique=False)

    op.create_table('optimized_blocks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('optimization_run_id', sa.Integer(), nullable=False),
        sa.Column('section_id', sa.String(length=50), nullable=True),
        sa.Column('block_start', sa.DateTime(timezone=True), nullable=True),
        sa.Column('block_end', sa.DateTime(timezone=True), nullable=True),
        sa.Column('block_duration_hrs', sa.Numeric(precision=6, scale=2), nullable=True),
        sa.Column('block_type', sa.String(length=50), nullable=True),
        sa.Column('is_integrated', sa.Boolean(), nullable=True),
        sa.Column('departments_involved', sa.String(length=200), nullable=True),
        sa.Column('priority_score', sa.Float(), nullable=True),
        sa.Column('train_conflicts', sa.Integer(), nullable=True),
        sa.Column('estimated_impact_score', sa.Float(), nullable=True),
        sa.Column('explanation', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['optimization_run_id'], ['optimization_runs.id'], ),
        sa.ForeignKeyConstraint(['section_id'], ['sections.section_id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_optimized_blocks_optimization_run_id'), 'optimized_blocks', ['optimization_run_id'], unique=False)
    op.create_index(op.f('ix_optimized_blocks_section_id'), 'optimized_blocks', ['section_id'], unique=False)

    op.create_table('section_station_map',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('section_id', sa.String(length=50), nullable=False),
        sa.Column('station_code', sa.String(length=20), nullable=False),
        sa.Column('station_sequence', sa.Integer(), nullable=True),
        sa.Column('km_from_section_start', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('relationship_type', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['section_id'], ['sections.section_id'], ),
        sa.ForeignKeyConstraint(['station_code'], ['stations.station_code'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('section_id', 'station_code', name='uq_section_station')
    )
    op.create_index('ix_section_station_map_section', 'section_station_map', ['section_id'], unique=False)
    op.create_index('ix_section_station_map_station', 'section_station_map', ['station_code'], unique=False)

    op.create_table('train_runs',
        sa.Column('run_id', sa.String(length=50), nullable=False),
        sa.Column('train_no', sa.String(length=20), nullable=False),
        sa.Column('train_name', sa.String(length=200), nullable=True),
        sa.Column('train_type', sa.String(length=50), nullable=True),
        sa.Column('section_id', sa.String(length=50), nullable=True),
        sa.Column('from_station_code', sa.String(length=20), nullable=True),
        sa.Column('to_station_code', sa.String(length=20), nullable=True),
        sa.Column('entry_time', sa.Time(), nullable=True),
        sa.Column('exit_time', sa.Time(), nullable=True),
        sa.Column('priority_rank', sa.Integer(), nullable=True),
        sa.Column('slack_time_window_mins', sa.Integer(), nullable=True),
        sa.Column('source_type', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['section_id'], ['sections.section_id'], ),
        sa.PrimaryKeyConstraint('run_id')
    )
    op.create_index(op.f('ix_train_runs_section_id'), 'train_runs', ['section_id'], unique=False)
    op.create_index(op.f('ix_train_runs_train_no'), 'train_runs', ['train_no'], unique=False)
    op.create_index(op.f('ix_train_runs_train_type'), 'train_runs', ['train_type'], unique=False)

    op.create_table('maintenance_tasks',
        sa.Column('task_id', sa.String(length=50), nullable=False),
        sa.Column('asset_id', sa.String(length=50), nullable=True),
        sa.Column('section_id', sa.String(length=50), nullable=True),
        sa.Column('department', sa.String(length=50), nullable=False),
        sa.Column('defect_type', sa.String(length=200), nullable=True),
        sa.Column('severity', sa.String(length=20), nullable=True),
        sa.Column('reported_date', sa.Date(), nullable=True),
        sa.Column('days_overdue', sa.Integer(), nullable=True),
        sa.Column('required_duration_hrs', sa.Numeric(precision=6, scale=2), nullable=True),
        sa.Column('postpone_penalty_cost', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column('priority_score', sa.Float(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=True),
        sa.Column('source_type', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['asset_id'], ['assets.asset_id'], ),
        sa.ForeignKeyConstraint(['section_id'], ['sections.section_id'], ),
        sa.PrimaryKeyConstraint('task_id')
    )
    op.create_index(op.f('ix_maintenance_tasks_asset_id'), 'maintenance_tasks', ['asset_id'], unique=False)
    op.create_index(op.f('ix_maintenance_tasks_department'), 'maintenance_tasks', ['department'], unique=False)
    op.create_index(op.f('ix_maintenance_tasks_section_id'), 'maintenance_tasks', ['section_id'], unique=False)

    op.create_table('train_section_occupancy',
        sa.Column('occupancy_id', sa.String(length=50), nullable=False),
        sa.Column('run_id', sa.String(length=50), nullable=True),
        sa.Column('train_id', sa.String(length=20), nullable=True),
        sa.Column('section_id', sa.String(length=50), nullable=True),
        sa.Column('track_id', sa.String(length=50), nullable=True),
        sa.Column('direction', sa.String(length=10), nullable=True),
        sa.Column('entry_time', sa.Time(), nullable=True),
        sa.Column('exit_time', sa.Time(), nullable=True),
        sa.Column('train_type', sa.String(length=50), nullable=True),
        sa.Column('priority_rank', sa.Integer(), nullable=True),
        sa.Column('source_type', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['run_id'], ['train_runs.run_id'], ),
        sa.ForeignKeyConstraint(['section_id'], ['sections.section_id'], ),
        sa.PrimaryKeyConstraint('occupancy_id')
    )
    op.create_index(op.f('ix_train_section_occupancy_run_id'), 'train_section_occupancy', ['run_id'], unique=False)
    op.create_index(op.f('ix_train_section_occupancy_section_id'), 'train_section_occupancy', ['section_id'], unique=False)
    op.create_index(op.f('ix_train_section_occupancy_train_id'), 'train_section_occupancy', ['train_id'], unique=False)

    op.create_table('block_request_tasks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('request_id', sa.String(length=50), nullable=False),
        sa.Column('task_id', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['request_id'], ['block_requests.request_id'], ),
        sa.ForeignKeyConstraint(['task_id'], ['maintenance_tasks.task_id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_block_request_tasks_request_id'), 'block_request_tasks', ['request_id'], unique=False)
    op.create_index(op.f('ix_block_request_tasks_task_id'), 'block_request_tasks', ['task_id'], unique=False)

    op.create_table('optimized_block_tasks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('optimized_block_id', sa.Integer(), nullable=False),
        sa.Column('task_id', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['optimized_block_id'], ['optimized_blocks.id'], ),
        sa.ForeignKeyConstraint(['task_id'], ['maintenance_tasks.task_id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_optimized_block_tasks_optimized_block_id'), 'optimized_block_tasks', ['optimized_block_id'], unique=False)
    op.create_index(op.f('ix_optimized_block_tasks_task_id'), 'optimized_block_tasks', ['task_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_optimized_block_tasks_task_id'), table_name='optimized_block_tasks')
    op.drop_index(op.f('ix_optimized_block_tasks_optimized_block_id'), table_name='optimized_block_tasks')
    op.drop_table('optimized_block_tasks')
    op.drop_index(op.f('ix_block_request_tasks_task_id'), table_name='block_request_tasks')
    op.drop_index(op.f('ix_block_request_tasks_request_id'), table_name='block_request_tasks')
    op.drop_table('block_request_tasks')
    op.drop_index(op.f('ix_train_section_occupancy_train_id'), table_name='train_section_occupancy')
    op.drop_index(op.f('ix_train_section_occupancy_section_id'), table_name='train_section_occupancy')
    op.drop_index(op.f('ix_train_section_occupancy_run_id'), table_name='train_section_occupancy')
    op.drop_table('train_section_occupancy')
    op.drop_index(op.f('ix_maintenance_tasks_section_id'), table_name='maintenance_tasks')
    op.drop_index(op.f('ix_maintenance_tasks_department'), table_name='maintenance_tasks')
    op.drop_index(op.f('ix_maintenance_tasks_asset_id'), table_name='maintenance_tasks')
    op.drop_table('maintenance_tasks')
    op.drop_index(op.f('ix_train_runs_train_type'), table_name='train_runs')
    op.drop_index(op.f('ix_train_runs_train_no'), table_name='train_runs')
    op.drop_index(op.f('ix_train_runs_section_id'), table_name='train_runs')
    op.drop_table('train_runs')
    op.drop_index('ix_section_station_map_station', table_name='section_station_map')
    op.drop_index('ix_section_station_map_section', table_name='section_station_map')
    op.drop_table('section_station_map')
    op.drop_index(op.f('ix_optimized_blocks_section_id'), table_name='optimized_blocks')
    op.drop_index(op.f('ix_optimized_blocks_optimization_run_id'), table_name='optimized_blocks')
    op.drop_table('optimized_blocks')
    op.drop_index(op.f('ix_operational_subsections_section_id'), table_name='operational_subsections')
    op.drop_table('operational_subsections')
    op.drop_index(op.f('ix_freight_forecasts_section_id'), table_name='freight_forecasts')
    op.drop_index(op.f('ix_freight_forecasts_date'), table_name='freight_forecasts')
    op.drop_table('freight_forecasts')
    op.drop_index(op.f('ix_corridor_windows_section_id'), table_name='corridor_windows')
    op.drop_table('corridor_windows')
    op.drop_index(op.f('ix_block_requests_section_id'), table_name='block_requests')
    op.drop_index(op.f('ix_block_requests_department'), table_name='block_requests')
    op.drop_table('block_requests')
    op.drop_index(op.f('ix_assets_section_id'), table_name='assets')
    op.drop_index(op.f('ix_assets_department'), table_name='assets')
    op.drop_index(op.f('ix_assets_asset_type'), table_name='assets')
    op.drop_table('assets')
    op.drop_table('sections')
    op.drop_index(op.f('ix_resource_availability_resource_id'), table_name='resource_availability')
    op.drop_table('resource_availability')
    op.drop_table('system_settings')
    op.drop_index('ix_stations_division', table_name='stations')
    op.drop_table('stations')
    op.drop_index(op.f('ix_resources_department'), table_name='resources')
    op.drop_table('resources')
    op.drop_table('optimization_runs')
    op.drop_table('divisions')
    op.drop_index(op.f('ix_audit_logs_user_id'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_timestamp'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_action'), table_name='audit_logs')
    op.drop_table('audit_logs')
