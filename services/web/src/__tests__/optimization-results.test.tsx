import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import OptimizationRunPage from "@/app/optimization/runs/[run_id]/page";
import { OptimizedBlockDetailDrawer } from "@/components/optimization/optimized-block-detail-drawer";
import { PlanningTimeline } from "@/components/optimization/planning-timeline";
import * as reactOidcContext from "react-oidc-context";
import * as optimizationApi from "@/lib/api/optimization";

vi.mock("next/navigation", () => ({
  usePathname: () => "/optimization/runs/1",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ run_id: "1" }),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock("react-oidc-context", () => ({
  useAuth: vi.fn(),
}));

const mockOptimalRun = {
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
  unassigned_task_ids: ["WO-0010", "WO-0011", "WO-0012"],
  warnings: [],
  notes: null,
  created_at: "2026-08-31T12:00:00Z",
  scheduled_blocks: [],
};

const mockInfeasibleRun = {
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
  warnings: ["Infeasible duration"],
  notes: null,
  created_at: "2026-08-31T11:30:00Z",
  scheduled_blocks: [],
};

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
    candidate_priority_value: 165.0,
    train_conflicts: 0,
    estimated_impact_score: null,
    resource_status: "UNVERIFIED",
    freight_impact: "LOW",
    task_ids: ["WO-0001", "WO-0002"],
    status: "Candidate",
    explanation: null,
    created_at: "2026-08-31T12:00:00Z",
  },
  {
    id: 102,
    optimization_run_id: 1,
    optimized_block_id: "OPT-BLK-0002",
    candidate_id: "CAND-HOW_SEC_002-CW-0002",
    section_id: "HOW_SEC_002",
    block_start: "2026-09-02T01:00:00Z",
    block_end: "2026-09-02T04:00:00Z",
    block_duration_hrs: 3.0,
    block_type: "single",
    is_integrated: false,
    departments_involved: ["TRD"],
    realized_priority_value: 88.5,
    candidate_priority_value: 88.5,
    train_conflicts: 0,
    estimated_impact_score: null,
    resource_status: "VERIFIED",
    freight_impact: "LOW",
    task_ids: ["WO-0003"],
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

describe("Optimization Results & Planning Timeline Workspace", () => {
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

    vi.spyOn(optimizationApi, "getOptimizationRun").mockResolvedValue(mockOptimalRun);
    vi.spyOn(optimizationApi, "getOptimizedBlocks").mockResolvedValue({
      items: mockBlocks,
      total: 2,
      page: 1,
      page_size: 100,
      total_pages: 1,
    });
    vi.spyOn(optimizationApi, "getOptimizationRuns").mockResolvedValue({
      items: [mockOptimalRun, mockInfeasibleRun],
      total: 2,
      page: 1,
      page_size: 10,
      total_pages: 1,
    });
  });

  it("renders run result page with accurate metrics and disclaimer", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <OptimizationRunPage params={Promise.resolve({ run_id: "1" })} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Optimization Plan:")).toBeInTheDocument();
      expect(screen.getAllByText("RUN-0001").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Requires human operational review and approval/i)).toBeInTheDocument();
      expect(screen.getAllByText("3840.50").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("4.12s")).toBeInTheDocument();
      expect(screen.getAllByText(/23/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders planning timeline with section rows and block bars", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <OptimizationRunPage params={Promise.resolve({ run_id: "1" })} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Corridor Maintenance Planning Timeline")).toBeInTheDocument();
      expect(screen.getAllByText("HOW_SEC_001").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("HOW_SEC_002").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("OPT-BLK-0001").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders optimized block detail drawer correctly with priority distinction", () => {
    render(
      <OptimizedBlockDetailDrawer
        block={mockBlocks[0]}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("Optimized Possession Recommendation")).toBeInTheDocument();
    expect(screen.getByText("Priority Value Realization")).toBeInTheDocument();
    expect(screen.getByText("Realized Priority Value")).toBeInTheDocument();
    expect(screen.getByText("Candidate Baseline Value")).toBeInTheDocument();
    expect(screen.getAllByText("177.80").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("165.00")).toBeInTheDocument();
    expect(screen.getByText("Work Orders Scheduled (2)")).toBeInTheDocument();
    expect(screen.getByText("WO-0001")).toBeInTheDocument();
    expect(screen.getByText("WO-0002")).toBeInTheDocument();
  });

  it("displays unassigned tasks with links to maintenance workbench", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <OptimizationRunPage params={Promise.resolve({ run_id: "1" })} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Unassigned Tasks \(3\)/i)).toBeInTheDocument();
    });

    // Click accordion header
    fireEvent.click(screen.getByText(/Unassigned Tasks \(3\)/i));

    await waitFor(() => {
      expect(screen.getByText("WO-0010")).toBeInTheDocument();
      expect(screen.getByText("WO-0011")).toBeInTheDocument();
      expect(screen.getByText("WO-0012")).toBeInTheDocument();
    });
  });

  it("renders railway network view placeholder for PostGIS GIS integration", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <OptimizationRunPage params={Promise.resolve({ run_id: "1" })} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByText("Railway Network View (PostGIS Spatial Overlay)")
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Interactive PostGIS track geometry map/i)
      ).toBeInTheDocument();
    });
  });

  it("handles INFEASIBLE run without rendering fake blocks", async () => {
    vi.spyOn(optimizationApi, "getOptimizationRun").mockResolvedValue(mockInfeasibleRun);

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <OptimizationRunPage params={Promise.resolve({ run_id: "2" })} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("No Feasible Plan Found")).toBeInTheDocument();
      expect(screen.getByText(/The OR-Tools CP-SAT solver determined that no combination/i)).toBeInTheDocument();
      expect(screen.getByText("Adjust Horizon in Planner")).toBeInTheDocument();
      expect(screen.getByText("Inspect Candidate Windows")).toBeInTheDocument();
      expect(screen.queryByText("Corridor Maintenance Planning Timeline")).toBeNull();
      expect(screen.queryByText("OPT-BLK-0001")).toBeNull();
    });
  });

  it("handles error state when run is not found", async () => {
    vi.spyOn(optimizationApi, "getOptimizationRun").mockRejectedValue(
      new Error("Run not found")
    );

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <OptimizationRunPage params={Promise.resolve({ run_id: "999" })} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Optimization Run Not Found")).toBeInTheDocument();
      expect(screen.getByText("Return to Optimization Planner")).toBeInTheDocument();
    });
  });
});
