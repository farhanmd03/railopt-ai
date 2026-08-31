import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import OptimizationPage from "@/app/optimization/page";
import * as reactOidcContext from "react-oidc-context";
import * as optimizationApi from "@/lib/api/optimization";

vi.mock("next/navigation", () => ({
  usePathname: () => "/optimization",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock("react-oidc-context", () => ({
  useAuth: vi.fn(),
}));

const mockRuns = [
  {
    id: 1,
    run_id: "RUN-0001",
    run_type: "standard",
    planning_horizon_start: "2026-08-31T00:00:00Z",
    planning_horizon_end: "2026-09-06T23:59:59Z",
    status: "Completed",
    solver_status: "OPTIMAL",
    objective_value: 3840.5,
    solve_time_seconds: 4.12,
    tasks_considered: 53,
    tasks_scheduled: 23,
    tasks_unassigned: 30,
    integrated_block_count: 5,
    separate_block_count: 7,
    estimated_total_block_hours: 48.5,
    unassigned_task_ids: ["WO-0010", "WO-0011"],
    warnings: [],
    notes: null,
    created_at: "2026-08-31T12:00:00Z",
  },
  {
    id: 2,
    run_id: "RUN-0002",
    run_type: "standard",
    planning_horizon_start: "2026-08-31T00:00:00Z",
    planning_horizon_end: "2026-09-01T23:59:59Z",
    status: "Completed",
    solver_status: "INFEASIBLE",
    objective_value: 0,
    solve_time_seconds: 0.85,
    tasks_considered: 53,
    tasks_scheduled: 0,
    tasks_unassigned: 53,
    integrated_block_count: 0,
    separate_block_count: 0,
    estimated_total_block_hours: 0,
    unassigned_task_ids: [],
    warnings: ["Short horizon infeasible"],
    notes: null,
    created_at: "2026-08-31T11:30:00Z",
  },
];

const mockBlocks = [
  {
    id: 101,
    optimization_run_id: 1,
    optimized_block_id: "OPT-BLK-0001",
    candidate_id: "CAND-HOW_SEC_001-CW-0001",
    section_id: "HOW_SEC_001",
    block_start: "2026-09-01T02:00:00Z",
    block_end: "2026-09-01T06:30:00Z",
    block_duration_hrs: 4.5,
    block_type: "integrated",
    is_integrated: true,
    departments_involved: ["Engineering", "S&T"],
    realized_priority_value: 177.8,
    candidate_priority_value: 177.8,
    train_conflicts: 0,
    estimated_impact_score: null,
    resource_status: "UNVERIFIED",
    freight_impact: "LOW",
    task_ids: ["WO-0001", "WO-0002"],
    status: "Candidate",
    explanation: null,
    created_at: "2026-08-31T12:00:00Z",
  },
];

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

describe("Railway Maintenance Optimization Planner", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(reactOidcContext, "useAuth").mockReturnValue({
      isAuthenticated: true,
      user: {
        profile: {
          sub: "planner-1",
          preferred_username: "planner.demo",
          given_name: "Planner",
          family_name: "Demo",
          realm_access: {
            roles: ["PLANNER"],
          },
        },
      },
    } as unknown as reactOidcContext.AuthContextProps);

    vi.spyOn(optimizationApi, "getOptimizationRuns").mockResolvedValue({
      items: mockRuns,
      total: 2,
      page: 1,
      page_size: 20,
      total_pages: 1,
    });

    vi.spyOn(optimizationApi, "getOptimizedBlocks").mockResolvedValue({
      items: mockBlocks,
      total: 1,
      page: 1,
      page_size: 100,
      total_pages: 1,
    });

    vi.spyOn(optimizationApi, "createOptimizationRun").mockResolvedValue(mockRuns[0]);
  });

  it("renders optimization planner header and user role", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <OptimizationPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Railway Maintenance Optimization Planner")).toBeInTheDocument();
      expect(screen.getByText(/HOWRAH DIVISION \(HWH\)/i)).toBeInTheDocument();
      expect(screen.getByText("Planner Demo")).toBeInTheDocument();
      expect(screen.getByText("PLANNER")).toBeInTheDocument();
    });
  });

  it("renders planning dates and validates invalid date range", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <OptimizationPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("1. Planning Horizon Window")).toBeInTheDocument();
    });

    const startInput = screen.getByLabelText(/planning start date/i) || screen.getAllByDisplayValue("2026-08-31")[0];
    const endInput = screen.getByLabelText(/planning end date/i) || screen.getAllByDisplayValue("2026-09-06")[0];

    // Set invalid range: start after end
    fireEvent.change(startInput, { target: { value: "2026-09-10" } });

    await waitFor(() => {
      expect(
        screen.getByText(/planning end date must be strictly after planning start date/i)
      ).toBeInTheDocument();
      // Generate button is disabled
      const generateBtn = screen.getByRole("button", { name: /generate optimal plan/i });
      expect(generateBtn).toBeDisabled();
    });
  });

  it("displays mandatory safety and integrity invariants", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <OptimizationPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Mandatory Safety & Integrity Invariants \(Protected\)/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/Single Task Assignment/i)).toBeInTheDocument();
      expect(screen.getByText(/Section Exclusivity/i)).toBeInTheDocument();
      expect(screen.getByText(/Horizon Invariant/i)).toBeInTheDocument();
    });
  });

  it("triggers optimization run and loads result upon successful solve", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <OptimizationPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /generate optimal plan/i })).toBeInTheDocument();
    });

    const generateBtn = screen.getByRole("button", { name: /generate optimal plan/i });
    expect(generateBtn).not.toBeDisabled();
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(optimizationApi.createOptimizationRun).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getAllByText("RUN-0001").length).toBeGreaterThan(0);
    });
  });

  it("handles INFEASIBLE run without rendering fake blocks", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <OptimizationPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Historical Optimization Runs (2)")).toBeInTheDocument();
    });

    // Inspect the second run (RUN-0002 which is INFEASIBLE)
    const inspectButtons = screen.getAllByRole("button", { name: /inspect/i });
    fireEvent.click(inspectButtons[0]); // click inspect on RUN-0002

    await waitFor(() => {
      expect(screen.getByText("No Feasible Schedule Found")).toBeInTheDocument();
      expect(screen.getByText(/no combination of candidate windows can satisfy all active hard constraints/i)).toBeInTheDocument();
      // No block rows rendered
      expect(screen.queryByText("OPT-BLK-0001")).toBeNull();
    });
  });

  it("disables Generate Optimal Plan for VIEWER role", async () => {
    vi.spyOn(reactOidcContext, "useAuth").mockReturnValue({
      isAuthenticated: true,
      user: {
        profile: {
          sub: "viewer-1",
          preferred_username: "viewer.demo",
          realm_access: {
            roles: ["VIEWER"],
          },
        },
      },
    } as unknown as reactOidcContext.AuthContextProps);

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <OptimizationPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      const generateBtn = screen.getByRole("button", { name: /generate optimal plan/i });
      expect(generateBtn).toBeDisabled();
      expect(screen.getByText(/Read-only mode \(VIEWER role cannot trigger solver runs\)/i)).toBeInTheDocument();
    });
  });

  it("renders scheduled blocks table with realized priority and departments", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <OptimizationPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("OPT-BLK-0001")).toBeInTheDocument();
      expect(screen.getByText("Integrated")).toBeInTheDocument();
      expect(screen.getAllByText("Realized Priority").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("177.80")).toBeInTheDocument();
      expect(screen.getByText("Engineering")).toBeInTheDocument();
      expect(screen.getByText("S&T")).toBeInTheDocument();
    });
  });

  it("handles API submission error gracefully", async () => {
    vi.spyOn(optimizationApi, "createOptimizationRun").mockRejectedValue(
      new Error("CP-SAT solver timeout during model pre-solve")
    );

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <OptimizationPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /generate optimal plan/i })).toBeInTheDocument();
    });

    const generateBtn = screen.getByRole("button", { name: /generate optimal plan/i });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(screen.getByText("Optimization Request Failed")).toBeInTheDocument();
      expect(
        screen.getByText("CP-SAT solver timeout during model pre-solve")
      ).toBeInTheDocument();
    });
  });
});
