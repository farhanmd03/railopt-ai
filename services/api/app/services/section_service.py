"""Section service for query and retrieval operations."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.geography import Section


class SectionService:
    """Service handling section data queries with filtering and pagination."""

    @staticmethod
    async def get_sections(
        db: AsyncSession,
        division_id: int | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Section], int]:
        """Fetch paginated list of sections with optional division filtering."""
        query = select(Section)
        count_query = select(func.count()).select_from(Section)

        if division_id is not None:
            query = query.where(Section.division_id == division_id)
            count_query = count_query.where(Section.division_id == division_id)

        # Count total matching rows in SQL
        total = (await db.execute(count_query)).scalar_one()

        # Apply pagination and sorting
        offset = (page - 1) * page_size
        query = query.order_by(Section.section_id.asc()).offset(offset).limit(page_size)

        result = await db.execute(query)
        items = list(result.scalars().all())

        return items, total

    @staticmethod
    async def get_section_by_id(
        db: AsyncSession,
        section_id: str,
    ) -> Section | None:
        """Fetch a single section by its business identifier."""
        query = select(Section).where(Section.section_id == section_id)
        result = await db.execute(query)
        return result.scalars().one_or_none()
