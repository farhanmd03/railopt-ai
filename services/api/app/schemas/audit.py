"""Audit API schemas (Batch 7J)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AuditLogResponse(BaseModel):
    """Immutable audit trail event record."""

    model_config = ConfigDict(from_attributes=True)

    id: int = Field(..., description="Audit event identifier")
    timestamp: datetime = Field(..., description="Timestamp of the audit event (UTC)")
    user_id: str | None = Field(None, description="Username or ID of the actor")
    action: str = Field(..., description="Action code (e.g. 'SUBMITTED', 'APPROVED', 'REJECTED')")
    entity_type: str | None = Field(None, description="Target entity type (e.g. 'OptimizationRun')")
    entity_id: str | None = Field(None, description="Target entity identifier")
    before_value: str | None = Field(None, description="Serialized previous state")
    after_value: str | None = Field(None, description="Serialized new state")
    details: str | None = Field(None, description="Context, commentary, or rejection reasons")
    ip_address: str | None = Field(None, description="Client IP address if captured")


class AuditLogListResponse(BaseModel):
    """List of audit events."""

    items: list[AuditLogResponse]
    total: int
