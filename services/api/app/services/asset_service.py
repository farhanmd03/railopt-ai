"""Asset service for query and retrieval operations."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asset import Asset


class AssetService:
    """Service handling asset queries with filtering and pagination."""

    @staticmethod
    async def get_assets(
        db: AsyncSession,
        department: str | None = None,
        asset_type: str | None = None,
        section_id: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Asset], int]:
        """Fetch paginated list of assets with optional filters."""
        query = select(Asset)
        count_query = select(func.count()).select_from(Asset)

        if department:
            query = query.where(Asset.department == department)
            count_query = count_query.where(Asset.department == department)

        if asset_type:
            query = query.where(Asset.asset_type == asset_type)
            count_query = count_query.where(Asset.asset_type == asset_type)

        if section_id:
            query = query.where(Asset.section_id == section_id)
            count_query = count_query.where(Asset.section_id == section_id)

        # Count total matching rows in SQL
        total = (await db.execute(count_query)).scalar_one()

        # Apply pagination and sorting
        offset = (page - 1) * page_size
        query = query.order_by(Asset.asset_id.asc()).offset(offset).limit(page_size)

        result = await db.execute(query)
        items = list(result.scalars().all())

        return items, total

    @staticmethod
    async def get_asset_by_id(
        db: AsyncSession,
        asset_id: str,
    ) -> Asset | None:
        """Fetch a single asset by its business identifier."""
        query = select(Asset).where(Asset.asset_id == asset_id)
        result = await db.execute(query)
        return result.scalars().one_or_none()
