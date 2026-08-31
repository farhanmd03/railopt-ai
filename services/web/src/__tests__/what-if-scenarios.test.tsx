import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import WhatIfScenarioPage from "@/app/optimization/runs/[run_id]/what-if/page";
import * as optimizationApi from "@/lib/api/optimization";
import * as scenariosApi from "@/lib/api/scenarios";
import * as reactOidcContext from "react-oidc-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OptimizationScenario } from "@/lib/types/scenario";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useParams: () => ({ run_id: "42" }),
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("react-oidc-context", () => ({
  useAuth: vi.fn(),
}));

const mockBaseRun: any = {
  id: 42,
  run_id: "RUN-0042",
  run_type: "standard",
  planning_horizon_start: "2026-09-01T00:00:00Z",
  planning_horizon_end: "2026-09-07T23:59:59Z",
  status: "Completed",
  solver_status: "OPTIMAL",
  objective_value: 7500.5,
  solve_time_seconds: 1.25,
  tasks_considered: 50,
  tasks_scheduled: 45,
  tasks_unassigned: 5,
  integrated_block_count: 12,
  separate_block_count: 6,
  estimated_total_block_hours: 80.5,
  approval_status: "DRAFT",
};

const mockScenarioResult: OptimizationScenario = {
  id: 101,
  scenario_id: "SCEN-TEST-001",
  name: "High Disruption Test Scenario",
  scenario_type: "OBJECTIVE_WEIGHTS",
  status: "COMPLETED",
  base_run_id: 42,
  scenario_run_id: 43,
  created_by: "planner.demo",
  created_at: "2026-08-31T20:00:00Z",
  notes: "Test notes",
  comparison: {
    tasks_scheduled: { original: 45, scenario: 42, delta: -3 },
    tasks_unassigned: { original: 5, scenario: 8, delta: 3 },
    block_count: { original: 18, scenario: 16, delta: -2 },
    integrated_blocks: { original: 12, scenario: 10, delta: -2 },
    estimated_total_block_hours: { original: 80.5, scenario: 74.0, delta: -6.5 },
    objective_value: { original: 7500.5, scenario: 7120.0, delta: -380.5 },
    explanation: "Under this scenario, the resulting optimization scheduled 42 tasks (-3 vs base run), yielding 16 total possession blocks (-2) with an objective value of 7120.0 (-380.5).",
  },
  task_impact: {
    retained_task_ids: ["TSK-01", "TSK-02"],
    newly_unassigned_task_ids: ["TSK-03", "TSK-04", "TSK-05"],
    newly_scheduled_task_ids: [],
    changed_block_task_ids: ["TSK-02"],
  },
  block_differences: {
    added_block_count: 1,
    removed_block_count: 3,
    retained_block_count: 15,
    added_blocks: [
      {
        id: 201,
        optimization_run_id: 43,
        optimized_block_id: "OPT-BLK-201",
        candidate_id: "CAND-001",
        section_id: "HWH-BWN",
        block_start: "2026-09-02T02:00:00Z",
        block_end: "2026-09-02T06:00:00Z",
        block_duration_hrs: 4.0,
        block_type: "integrated",
        is_integrated: true,
        departments_involved: ["ENGG", "TRD"],
        realized_priority_value: 85,
        candidate_priority_value: 80,
        train_conflicts: 0,
        estimated_impact_score: 90,
        resource_status: "VERIFIED",
        freight_impact: "LOW",
        task_ids: ["TSK-01", "TSK-02"],
        status: "Candidate",
        explanation: {},
        created_at: "2026-08-31T20:00:00Z",
      },
    ],
    removed_blocks: [],
    retained_blocks: [],
  },
};

describe("What-If Scenario Laboratory Workspace", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    vi.spyOn(reactOidcContext, "useAuth").mockReturnValue({
      isAuthenticated: true,
      user: {
        profile: {
          sub: "user-1",
          preferred_username: "planner.demo",
          realm_access: { roles: ["PLANNER"] },
        },
      },
    } as any);

    vi.spyOn(optimizationApi, "getOptimizationRun").mockResolvedValue(mockBaseRun);
    vi.spyOn(scenariosApi, "getRunScenarios").mockResolvedValue({
      items: [mockScenarioResult],
      total: 1,
    });
    vi.spyOn(scenariosApi, "getScenarioDetail").mockResolvedValue(mockScenarioResult);
    vi.spyOn(scenariosApi, "createRunScenario").mockResolvedValue(mockScenarioResult);
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <WhatIfScenarioPage />
      </QueryClientProvider>
    );

  it("renders base run metadata as read-only and displays hard invariants as locked", async () => {
    renderComponent();

    expect(await screen.findByText(/BASE RUN — READ ONLY/i)).toBeInTheDocument();
    expect(screen.getByText(/SCENARIO RUN — EXPERIMENTAL/i)).toBeInTheDocument();

    // Verify locked hard constraints are visibly indicated
    expect(screen.getByText("Single Task Assignment")).toBeInTheDocument();
    expect(screen.getByText("Section Exclusivity")).toBeInTheDocument();
    expect(screen.getByText("Train Conflict Rules")).toBeInTheDocument();
  });

  it("renders comparison KPI table with mathematical deltas and explanation", async () => {
    renderComponent();

    // Check deterministic narrative
    expect(
      await screen.findByText(/Deterministic Scenario Impact Assessment/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Under this scenario, the resulting optimization scheduled 42 tasks/i)
    ).toBeInTheDocument();

    // Check KPI table headers
    expect(screen.getByText("Tasks Scheduled")).toBeInTheDocument();
    expect(screen.getByText("Total Maintenance Blocks")).toBeInTheDocument();
    expect(screen.getByText("Estimated Total Block Hours")).toBeInTheDocument();
  });

  it("renders task-level impact analysis with newly unassigned items", async () => {
    renderComponent();

    expect(await screen.findByText("Task-Level Impact Analysis")).toBeInTheDocument();
    expect(screen.getByText("Newly Unassigned")).toBeInTheDocument();

    // Check task badges
    expect(screen.getByText("TSK-03")).toBeInTheDocument();
    expect(screen.getByText("TSK-04")).toBeInTheDocument();
  });

  it("renders block-level corridor comparison and map deep-link", async () => {
    renderComponent();

    expect(await screen.findByText("Block-Level Corridor Comparison")).toBeInTheDocument();
    expect(screen.getByText("Added Blocks")).toBeInTheDocument();
    expect(screen.getByText("HWH-BWN")).toBeInTheDocument();

    // Deep link to map
    const mapLinks = screen.getAllByRole("link", { name: /map/i });
    expect(mapLinks.length).toBeGreaterThan(0);
  });

  it("submits new scenario with custom weights and updates comparison view", async () => {
    renderComponent();

    const nameInput = await screen.findByLabelText(/Scenario Name/i);
    fireEvent.change(nameInput, { target: { value: "New Custom Scenario" } });

    const submitBtn = screen.getByRole("button", { name: /Run What-If Scenario/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(scenariosApi.createRunScenario).toHaveBeenCalledTimes(1);
    });
  });
});
