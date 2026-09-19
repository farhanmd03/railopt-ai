"""In-app Notifications API router (Badge 4A)."""

from datetime import datetime, timezone
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import User, get_current_user
from app.models.notification import Notification
from app.schemas.notification import NotificationListResponse, NotificationResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get(
    "",
    response_model=NotificationListResponse,
    status_code=status.HTTP_200_OK,
    summary="List current user notifications",
)
async def list_notifications(
    limit: int = Query(50, ge=1, le=100, description="Max items to return"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationListResponse:
    """Retrieve notifications isolated to the current authenticated user."""
    # Ensure isolation using the username, exactly as recorded in audit trails
    user_identifier = current_user.username

    base_query = select(Notification).where(Notification.user_id == user_identifier)

    # Calculate counts
    total = (await db.scalar(select(func.count()).select_from(base_query.subquery()))) or 0
    unread_count = (
        await db.scalar(
            select(func.count())
            .select_from(base_query.where(Notification.is_read == False).subquery())
        )
    ) or 0

    # Retrieve items, newest first
    stmt = base_query.order_by(Notification.created_at.desc()).limit(limit)
    notifications = (await db.scalars(stmt)).all()

    return NotificationListResponse(
        items=[
            NotificationResponse.model_validate(n) for n in notifications
        ],
        total=total,
        unread_count=unread_count,
    )


@router.get(
    "/{notification_id}",
    response_model=NotificationResponse,
    status_code=status.HTTP_200_OK,
    summary="Get single notification",
)
async def get_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationResponse:
    """Retrieve a single notification, enforcing ownership."""
    notification = await db.get(Notification, notification_id)
    
    if not notification or notification.user_id != current_user.username:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found.",
        )
        
    return NotificationResponse.model_validate(notification)


@router.patch(
    "/{notification_id}/read",
    response_model=NotificationResponse,
    status_code=status.HTTP_200_OK,
    summary="Mark notification as read",
)
async def mark_notification_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationResponse:
    """Mark a specific user notification as read."""
    notification = await db.get(Notification, notification_id)
    
    if not notification or notification.user_id != current_user.username:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found.",
        )
        
    if not notification.is_read:
        notification.is_read = True
        notification.read_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(notification)
        
    return NotificationResponse.model_validate(notification)


@router.patch(
    "/read-all",
    status_code=status.HTTP_200_OK,
    summary="Mark all user notifications as read",
)
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Mark all unread notifications for the current user as read."""
    stmt = (
        update(Notification)
        .where(
            Notification.user_id == current_user.username,
            Notification.is_read == False,
        )
        .values(
            is_read=True,
            read_at=datetime.now(timezone.utc),
        )
    )
    
    await db.execute(stmt)
    await db.commit()
    
    return {"message": "All notifications marked as read."}