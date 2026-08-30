"""Station service for query and retrieval operations."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.geography import SectionStationMap, Station


class StationService:
    """Service handling station data queries with filtering and pagination."""

    @staticmethod
    async def get_stations(
        db: AsyncSession,
        section_id: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Station], int]:
        """Fetch paginated list of stations with optional section mapping filtering."""
        query = select(Station)
        count_query = select(func.count()).select_from(Station)

        if section_id:
            query = query.join(
                SectionStationMap,
                Station.station_code == SectionStationMap.station_code,
            ).where(SectionStationMap.section_id == section_id)

            count_query = count_query.join(
                SectionStationMap,
                Station.station_code == SectionStationMap.station_code,
            ).where(SectionStationMap.section_id == section_id)

            query = query.order_by(SectionStationMap.station_sequence.asc(), Station.station_code.asc())
        else:
            query = query.order_by(Station.station_code.asc())

        # Count total matching rows in SQL
        total = (await db.execute(count_query)).scalar_one()

        # Apply pagination
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)

        result = await db.execute(query)
        items = list(result.scalars().all())

        return items, total

    @staticmethod
    async def get_station_by_code(
        db: AsyncSession,
        station_code: str,
    ) -> Station | None:
        """Fetch a single station by its code."""
        query = select(Station).where(Station.station_code == station_code)
        result = await db.execute(query)
        return result.scalars().one_or_none()
