import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CounterfactualComparisonCard } from "@/components/optimization/counterfactual-comparison-card";
import { CounterfactualComparison } from "@/lib/types/scenario";

const mockComparisonBetter: CounterfactualComparison = {
  target_block_id: 101,
  scenario_type: "POSTPONE",
  rating: "BETTER",
  explanation:
    "Postponing block OPT-BLK-0101 by 2.0h shifts the window to 2026-10-01 10:00–14:00 UTC. Train conflicts change by -1 (from 1 to 0). Priority delivered remains 150.0 across 2 tasks. Possession readiness evaluates to GO (improved).",
  baseline: {
    block_id: 101,
    optimized_block_id: "OPT-BLK-0101",
    section_id: "SEC-NDLS-GZB",
    block_start: "2026-10-01T08:00:00Z",
    block_end: "2026-10-01T12:00:00Z",
    duration_hrs: 4.0,
    is_integrated: true,
    departments: ["ENGINEERING", "SNT"],
    task_ids: ["TSK-001", "TSK-002"],
    priority_score: 150.0,
    train_conflicts: 1,
    estimated_impact_score: 75.0,
    readiness: {
      block_id: 101,
      readiness: "HOLD",
      summary: "The proposed block has unresolved readiness items and should remain on hold.",
      checks: [
        { key: "window", label: "Possession window", status: "PASS", message: "Proposed window is valid for 4.00 hours." },
        { key: "train_conflicts", label: "Train conflict check", status: "PENDING", message: "1 train conflict(s) remain associated with this proposed block." },
        { key: "resources", label: "Resource readiness", status: "PASS", message: "Required resources are marked as ready/verified." },
        { key: "block_status", label: "Block status", status: "PASS", message: "Block is currently in 'Candidate' status." },
      ],
    },
  },
  alternative: {
    block_id: 101,
    optimized_block_id: "OPT-BLK-0101",
    section_id: "SEC-NDLS-GZB",
    block_start: "2026-10-01T10:00:00Z",
    block_end: "2026-10-01T14:00:00Z",
    duration_hrs: 4.0,
    is_integrated: true,
    departments: ["ENGINEERING", "SNT"],
    task_ids: ["TSK-001", "TSK-002"],
    priority_score: 150.0,
    train_conflicts: 0,
    estimated_impact_score: 90.0,
    readiness: {
      block_id: 101,
      readiness: "GO",
      summary: "All prototype readiness checks pass. Final possession approval remains a human decision.",
      checks: [
        { key: "window", label: "Possession window", status: "PASS", message: "Proposed window is valid for 4.00 hours." },
        { key: "train_conflicts", label: "Train conflict check", status: "PASS", message: "No train conflicts are recorded for this proposed block." },
        { key: "resources", label: "Resource readiness", status: "PASS", message: "Required resources are marked as ready/verified." },
        { key: "block_status", label: "Block status", status: "PASS", message: "Block is currently in 'Candidate' status." },
      ],
    },
  },
  deltas: {
    duration_delta: 0.0,
    priority_delta: 0.0,
    train_conflicts_delta: -1,
    estimated_impact_delta: 15.0,
    tasks_added: [],
    tasks_removed: [],
    readiness_change: "IMPROVED",
  },
};

describe("CounterfactualComparisonCard Component", () => {
  it("renders side-by-side baseline vs alternative comparison table", () => {
    render(
      <CounterfactualComparisonCard
        comparison={mockComparisonBetter}
        scenarioName="Postpone Block OPT-BLK-0101 by 2h"
      />
    );

    expect(screen.getByText("Baseline Block vs Alternative Scenario Comparison")).toBeInTheDocument();
    expect(screen.getByText("BETTER ALTERNATIVE")).toBeInTheDocument();
    expect(screen.getByText(/Postponing block OPT-BLK-0101 by 2.0h/i)).toBeInTheDocument();

    // Check evaluation dimensions
    expect(screen.getByText("Possession Window")).toBeInTheDocument();
    expect(screen.getByText("Block Duration")).toBeInTheDocument();
    expect(screen.getByText("Delivered Priority Score")).toBeInTheDocument();
    expect(screen.getByText("Train Timetable Conflicts")).toBeInTheDocument();
    expect(screen.getByText("Possession Readiness Gate")).toBeInTheDocument();

    // Check readiness badge change
    expect(screen.getByText("IMPROVED")).toBeInTheDocument();
  });

  it("renders alternative readiness check breakdown items", () => {
    render(
      <CounterfactualComparisonCard
        comparison={mockComparisonBetter}
        scenarioName="Postpone Block OPT-BLK-0101 by 2h"
      />
    );

    expect(screen.getByText("Alternative Possession Readiness Checks")).toBeInTheDocument();
    expect(screen.getByText("No train conflicts are recorded for this proposed block.")).toBeInTheDocument();
    expect(screen.getByText("Required resources are marked as ready/verified.")).toBeInTheDocument();
  });
});
