"""Health-check response schemas."""

from pydantic import BaseModel


class HealthResponse(BaseModel):
    """Response model for the basic health-check endpoint."""

    status: str
    service: str
    version: str = "0.1.0"


class DatabaseHealthResponse(HealthResponse):
    """Response model for the database connectivity health check."""

    database: str
    postgis: str | None = None
