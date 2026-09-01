"""Optimization output models.

``OptimizationRun`` → ``OptimizedBlock`` → ``OptimizedBlockTask``

These represent the optimizer's *recommendations*, NOT approved railway
blocks.  Human authorities review and approve via the approval workflow.
"""

from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class OptimizationRun(TimestampMixin, Base):
    """Record of a single optimization/solver run."""

    __tablename__ = "optimization_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    run_type: Mapped[str | None] = mapped_column(
        String(50)
    )  # weekly | monthly | scenario
    planning_horizon_start: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    planning_horizon_end: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    status: Mapped[str | None] = mapped_column(
        String(50), default="Pending"
    )  # Pending | Running | Completed | Failed
    solver_status: Mapped[str | None] = mapped_column(
        String(50)
    )  # OPTIMAL | FEASIBLE | INFEASIBLE | etc.
    objective_value: Mapped[float | None] = mapped_column(Float)
    solve_time_seconds: Mapped[float | None] = mapped_column(Float)
    parameters: Mapped[str | None] = mapped_column(Text)  # JSON string
    notes: Mapped[str | None] = mapped_column(Text)

    # ── Human Approval Workflow (Batch 7J) ────────────────────────
    approval_status: Mapped[str | None] = mapped_column(
        String(50), default="DRAFT"
    )  # DRAFT | SUBMITTED | APPROVED | REJECTED
    submitted_by: Mapped[str | None] = mapped_column(String(100))
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    approved_by: Mapped[str | None] = mapped_column(String(100))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rejected_by: Mapped[str | None] = mapped_column(String(100))
    rejected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rejection_reason: Mapped[str | None] = mapped_column(Text)

    # ── Relationships ────────────────────────────────────────────
    optimized_blocks: Mapped[list["OptimizedBlock"]] = relationship(
        back_populates="optimization_run"
    )


class OptimizedBlock(TimestampMixin, Base):
    """A recommended maintenance block produced by the optimizer.

    ``is_integrated`` flags blocks that combine tasks from multiple
    departments — a key differentiating feature of the system.
    """

    __tablename__ = "optimized_blocks"
    __table_args__ = (
        CheckConstraint("block_start < block_end", name="ck_optimized_blocks_start_before_end"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    optimization_run_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("optimization_runs.id"),
        nullable=False,
        index=True,
    )
    section_id: Mapped[str | None] = mapped_column(
        String(50), ForeignKey("sections.section_id"), index=True
    )
    block_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    block_end: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    block_duration_hrs: Mapped[float | None] = mapped_column(Numeric(6, 2))
    block_type: Mapped[str | None] = mapped_column(
        String(50)
    )  # single | integrated
    is_integrated: Mapped[bool | None] = mapped_column(Boolean, default=False)
    departments_involved: Mapped[str | None] = mapped_column(
        String(200)
    )  # e.g. "Engineering,S&T,TRD"
    priority_score: Mapped[float | None] = mapped_column(Float)
    train_conflicts: Mapped[int | None] = mapped_column(Integer, default=0)
    estimated_impact_score: Mapped[float | None] = mapped_column(Float)
    explanation: Mapped[str | None] = mapped_column(Text)  # structured JSON
    status: Mapped[str | None] = mapped_column(
        String(50), default="Candidate"
    )  # Candidate | Feasible | Approved | Rejected | Completed

    # ── Relationships ────────────────────────────────────────────
    optimization_run: Mapped["OptimizationRun"] = relationship(
        back_populates="optimized_blocks"
    )
    tasks: Mapped[list["OptimizedBlockTask"]] = relationship(
        back_populates="optimized_block"
    )


class OptimizedBlockTask(TimestampMixin, Base):
    """Junction linking an optimized block to maintenance tasks it covers."""

    __tablename__ = "optimized_block_tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    optimized_block_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("optimized_blocks.id"),
        nullable=False,
        index=True,
    )
    task_id: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("maintenance_tasks.task_id"),
        nullable=False,
        index=True,
    )

    # ── Relationships ────────────────────────────────────────────
    optimized_block: Mapped["OptimizedBlock"] = relationship(
        back_populates="tasks"
    )

    __table_args__ = (
        UniqueConstraint(
            "optimized_block_id", "task_id", name="uq_optimized_block_task"
        ),
    )


class OptimizationScenario(TimestampMixin, Base):
    """What-If Scenario comparing an alternative optimization configuration against a base run."""

    __tablename__ = "optimization_scenarios"

    id: Mapped[int] = mapped_column(primary_key=True)
    scenario_id: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    scenario_type: Mapped[str] = mapped_column(
        String(50), default="OBJECTIVE_WEIGHTS", nullable=False
    )  # OBJECTIVE_WEIGHTS | HORIZON | CANDIDATE_EXCLUSION
    status: Mapped[str] = mapped_column(
        String(50), default="SCENARIO_CREATED", nullable=False
    )  # SCENARIO_CREATED | RUNNING | COMPLETED | INFEASIBLE | FAILED
    base_run_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("optimization_runs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    scenario_run_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("optimization_runs.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_by: Mapped[str | None] = mapped_column(String(100))
    parameters: Mapped[str | None] = mapped_column(Text)  # JSON text
    notes: Mapped[str | None] = mapped_column(Text)

    # ── Relationships ────────────────────────────────────────────
    base_run: Mapped["OptimizationRun"] = relationship(
        "OptimizationRun", foreign_keys=[base_run_id]
    )
    scenario_run: Mapped["OptimizationRun | None"] = relationship(
        "OptimizationRun", foreign_keys=[scenario_run_id]
    )
