"""Maintenance task service for query and retrieval operations."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asset import MaintenanceTask


class MaintenanceService:
    """Service handling maintenance task queries with filtering and pagination."""

    @staticmethod
    async def get_maintenance_tasks(
        db: AsyncSession,
        department: str | None = None,
        severity: str | None = None,
        status: str | None = None,
        section_id: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[MaintenanceTask], int]:
        """Fetch paginated list of maintenance tasks with optional filters."""
        query = select(MaintenanceTask)
        count_query = select(func.count()).select_from(MaintenanceTask)

        if department:
            query = query.where(MaintenanceTask.department == department)
            count_query = count_query.where(MaintenanceTask.department == department)

        if severity:
            query = query.where(MaintenanceTask.severity == severity)
            count_query = count_query.where(MaintenanceTask.severity == severity)

        if status:
            query = query.where(MaintenanceTask.status == status)
            count_query = count_query.where(MaintenanceTask.status == status)

        if section_id:
            query = query.where(MaintenanceTask.section_id == section_id)
            count_query = count_query.where(MaintenanceTask.section_id == section_id)

        # Count total matching rows in SQL
        total = (await db.execute(count_query)).scalar_one()

        # Apply pagination and sorting (by priority_score desc, task_id asc)
        offset = (page - 1) * page_size
        query = query.order_by(MaintenanceTask.priority_score.desc().nullslast(), MaintenanceTask.task_id.asc()).offset(offset).limit(page_size)

        result = await db.execute(query)
        items = list(result.scalars().all())

        return items, total

    @staticmethod
    async def get_maintenance_task_by_id(
        db: AsyncSession,
        task_id: str,
    ) -> MaintenanceTask | None:
        """Fetch a single maintenance task by its work order identifier."""
        query = select(MaintenanceTask).where(MaintenanceTask.task_id == task_id)
        result = await db.execute(query)
        return result.scalars().one_or_none()
