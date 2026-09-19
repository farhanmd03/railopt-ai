import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SourceBadge } from "@/components/optimization/source-badge";
import { PossessionOutcomePanel } from "@/components/optimization/possession-outcome-panel";
import { SOURCE_BADGES } from "@/lib/types/possession";
import * as possessionApi from "@/lib/api/possession";
import type { OptimizedBlock } from "@/lib/types/optimization";
import type { PossessionOutcome } from "@/lib/types/possession";

const mockBlock: OptimizedBlock = {
  id: 101,
  optimization_run_id: 1,
  optimized_block_id: "OPT-BLK-0101",
  candidate_id: "CAND-01",
  section_id: "HWH-BWN",
  block_start: "2026-09-20T02:00:00Z",
  block_end: "2026-09-20T06:00:00Z",
  block_duration_hrs: 4.0,
  block_type: "integrated",
  is_integrated: true,
  departments_involved: ["Engineering", "S&T", "TRD"],
  realized_priority_value: 8.5,
  candidate_priority_value: 7.0,
  train_conflicts: 0,
  estimated_impact_score: 0.92,
  resource_status: "VERIFIED",
  freight_impact: "LOW",
  task_ids: ["TSK-001", "TSK-002"],
  status: "Approved",
  explanation: null,
  created_at: "2026-09-20T01:00:00Z",
};

const mockOutcome: PossessionOutcome = {
  id: 50,
  optimized_block_id: 101,
  planned_start: "2026-09-20T02:00:00Z",
  planned_end: "2026-09-20T06:00:00Z",
  actual_start: "2026-09-20T02:15:00Z",
  actual_end: "2026-09-20T06:15:00Z",
  status: "COMPLETED",
  delay_minutes: 15,
  cancellation_reason: null,
  affected_departments: ["Engineering", "S&T", "TRD"],
  planned_impact_score: 0.92,
  actual_impact_score: 0.88,
  notes: "Completed safely with slight 15m startup delay",
  recorded_by: "planner.demo",
  created_at: "2026-09-20T06:30:00Z",
  updated_at: "2026-09-20T06:30:00Z",
};

describe("Badge 4 — Source Data Provenance Badges", () => {
  it("maps Engineering to TMS with prototype label", () => {
    expect(SOURCE_BADGES.Engineering.source).toBe("TMS");
    expect(SOURCE_BADGES.Engineering.label).toBe("Track Management System");
    expect(SOURCE_BADGES.Engineering.isPrototype).toBe(true);

    render(<SourceBadge department="Engineering" />);
    expect(screen.getByText("TMS")).toBeInTheDocument();
    expect(screen.getByText("Prototype")).toBeInTheDocument();
  });

  it("maps S&T to SMMS with prototype label", () => {
    expect(SOURCE_BADGES["S&T"].source).toBe("SMMS");
    expect(SOURCE_BADGES["S&T"].label).toBe(
      "Signal Maintenance Management System",
    );
    expect(SOURCE_BADGES["S&T"].isPrototype).toBe(true);

    render(<SourceBadge department="S&T" />);
    expect(screen.getByText("SMMS")).toBeInTheDocument();
    expect(screen.getByText("Prototype")).toBeInTheDocument();
  });

  it("maps TRD to TDMS with prototype label", () => {
    expect(SOURCE_BADGES.TRD.source).toBe("TDMS");
    expect(SOURCE_BADGES.TRD.label).toBe(
      "Traction Distribution Management System",
    );
    expect(SOURCE_BADGES.TRD.isPrototype).toBe(true);

    render(<SourceBadge department="TRD" />);
    expect(screen.getByText("TDMS")).toBeInTheDocument();
    expect(screen.getByText("Prototype")).toBeInTheDocument();
  });

  it("maps Timetable to COA with prototype label", () => {
    expect(SOURCE_BADGES.Timetable.source).toBe("COA");
    expect(SOURCE_BADGES.Timetable.label).toContain("Control Office");
    expect(SOURCE_BADGES.Timetable.isPrototype).toBe(true);

    render(<SourceBadge department="Timetable" />);
    expect(screen.getByText("COA")).toBeInTheDocument();
    expect(screen.getByText("Prototype")).toBeInTheDocument();
  });

  it("returns null for unknown department", () => {
    const { container } = render(<SourceBadge department="UnknownDept" />);
    expect(container.firstChild).toBeNull();
  });
});

describe("Badge 4 — Possession Outcome Panel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when no outcome is recorded", async () => {
    vi.spyOn(possessionApi, "getBlockPossessionOutcomes").mockResolvedValue([]);

    render(<PossessionOutcomePanel block={mockBlock} isAuthorized={false} />);

    await waitFor(() => {
      expect(
        screen.getByText(/No execution outcome recorded yet/i),
      ).toBeInTheDocument();
    });
  });

  it("renders outcome ledger details when recorded", async () => {
    vi.spyOn(possessionApi, "getBlockPossessionOutcomes").mockResolvedValue([
      mockOutcome,
    ]);

    render(<PossessionOutcomePanel block={mockBlock} isAuthorized={false} />);

    await waitFor(() => {
      expect(screen.getByText("COMPLETED")).toBeInTheDocument();
      expect(screen.getByText("15 minutes")).toBeInTheDocument();
      expect(
        screen.getByText(/Completed safely with slight 15m startup delay/i),
      ).toBeInTheDocument();
      expect(screen.getByText("planner.demo")).toBeInTheDocument();
    });
  });

  it("displays record button when authorized and no outcome exists", async () => {
    vi.spyOn(possessionApi, "getBlockPossessionOutcomes").mockResolvedValue([]);

    render(<PossessionOutcomePanel block={mockBlock} isAuthorized={true} />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /\+ Record Execution Outcome/i }),
      ).toBeInTheDocument();
    });
  });
});
