import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DashboardPage from "@/app/dashboard/page";
import * as reactOidcContext from "react-oidc-context";
import * as maintenanceApi from "@/lib/api/maintenance";
import * as candidateBlocksApi from "@/lib/api/candidate-blocks";
import * as optimizationApi from "@/lib/api/optimization";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock("react-oidc-context", () => ({
  useAuth: vi.fn(),
}));

const mockTasks = [
  {
    task_id: "WO-0001",
    asset_id: "TRK-HWH-01",
    section_id: "HOW_SEC_001",
    department: "Engineering",
    defect_type: "Rail Fracture",
    severity: "Critical",
    reported_date: "2026-08-25",
    days_overdue: 6,
    required_duration_hrs: 4.5,
    postpone_penalty_cost: 15000,
    priority_score: 95.5,
    status: "Open",
    source_type: "Inspection",
  },
  {
    task_id: "WO-0002",
    asset_id: "SIG-HWH-01",
    section_id: "HOW_SEC_001",
    department: "S&T",
    defect_type: "Signal Lamp Failure",
    severity: "High",
    reported_date: "2026-08-28",
    days_overdue: 3,
    required_duration_hrs: 2.0,
    postpone_penalty_cost: 8000,
    priority_score: 82.3,
    status: "Open",
    source_type: "Telemetry",
  },
  {
    task_id: "WO-0003",
    asset_id: "OHE-BDC-02",
    section_id: "HOW_SEC_002",
    department: "TRD",
    defect_type: "Catenary Sag",
    severity: "Medium",
    reported_date: "2026-08-29",
    days_overdue: 0,
    required_duration_hrs: 3.0,
    postpone_penalty_cost: 4000,
    priority_score: 64.1,
    status: "Open",
    source_type: "Inspection",
  },
  {
    task_id: "WO-0004",
    asset_id: "TRK-BWN-01",
    section_id: "HOW_SEC_003",
    department: "Engineering",
    defect_type: "Sleeper Spacing",
    severity: "Low",
    reported_date: "2026-08-30",
    days_overdue: 0,
    required_duration_hrs: 1.5,
    postpone_penalty_cost: 1000,
    priority_score: 38.0,
    status: "Open",
    source_type: "Routine",
  },
];

const mockOpportunities = [
  {
    opportunity_id: "OPP-HOW_SEC_001-WO-0001-WO-0002",
    section_id: "HOW_SEC_001",
    task_ids: ["WO-0001", "WO-0002"],
    departments_involved: ["Engineering", "S&T"],
    is_cross_department: true,
    compatibility_status: "COMPATIBLE",
    compatibility_score: 100.0,
    combined_duration_hrs: 4.5,
    priority_summary: {
      highest_task_priority: 95.5,
      average_task_priority: 88.9,
      total_priority_value: 177.8,
    },
    compatibility_reasons: ["Co-located on HOW_SEC_001"],
  },
];

const mockCandidates = [
  {
    candidate_id: "CAND-HOW_SEC_001-CW-0001-WO-0001",
    opportunity_id: null,
    section_id: "HOW_SEC_001",
    window_id: "CW-0001",
    candidate_start: "2026-09-01T02:00:00Z",
    candidate_end: "2026-09-01T06:30:00Z",
    required_duration_hrs: 4.5,
    window_duration_hrs: 5.0,
    computed_feasibility_status: "FEASIBLE",
    train_conflict: false,
    train_conflict_count: 0,
    priority_score: 95.5,
    compatibility_score: 100.0,
    candidate_score: 96.0,
    departments_involved: ["Engineering"],
    task_ids: ["WO-0001"],
    reasons: ["Window provides 5.0h for required 4.5h task"],
  },
];

const mockLatestRun = {
  id: 42,
  run_id: "RUN-TEST-001",
  run_type: "production",
  planning_horizon_start: "2026-08-31T00:00:00Z",
  planning_horizon_end: "2026-09-06T23:59:00Z",
  status: "Completed",
  solver_status: "OPTIMAL",
  objective_value: 7115.39,
  solve_time_seconds: 3.45,
  tasks_considered: 53,
  tasks_scheduled: 45,
  tasks_unassigned: 8,
  integrated_block_count: 15,
  separate_block_count: 4,
  estimated_total_block_hours: 86.66,
  unassigned_task_ids: ["WO-0007", "WO-0008"],
  warnings: [],
  notes: "Test CP-SAT optimization plan",
  created_at: "2026-08-30T18:00:00Z",
};

const mockOptimizedBlocks = [
  {
    id: 101,
    optimization_run_id: 42,
    optimized_block_id: "OPT-CAND-HOW_SEC_001-CW-0001-OPP-1",
    candidate_id: "CAND-HOW_SEC_001-CW-0001-OPP-1",
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
    estimated_impact_score: 95.0,
    resource_status: "VERIFIED",
    freight_impact: "LOW",
    task_ids: ["WO-0001", "WO-0002"],
    status: "Candidate",
    explanation: null,
    created_at: "2026-08-30T18:00:00Z",
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

describe("Live Operations Dashboard Page", () => {
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

    vi.spyOn(maintenanceApi, "getMaintenanceTasks").mockResolvedValue({
      items: mockTasks,
      total: 53,
      page: 1,
      page_size: 100,
      total_pages: 1,
    });

    vi.spyOn(maintenanceApi, "getIntegrationOpportunities").mockResolvedValue({
      items: mockOpportunities,
      total: 404,
      page: 1,
      page_size: 5,
      total_pages: 81,
    });

    vi.spyOn(candidateBlocksApi, "getCandidateBlocks").mockResolvedValue({
      items: mockCandidates,
      total: 15652,
      page: 1,
      page_size: 5,
      total_pages: 3131,
    });

    vi.spyOn(optimizationApi, "getOptimizationRuns").mockResolvedValue({
      items: [mockLatestRun],
      total: 1,
      page: 1,
      page_size: 1,
      total_pages: 1,
    });

    vi.spyOn(optimizationApi, "getOptimizedBlocks").mockResolvedValue({
      items: mockOptimizedBlocks,
      total: 19,
      page: 1,
      page_size: 6,
      total_pages: 4,
    });
  });

  it("renders dashboard header with division context and authenticated user", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <DashboardPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/HOWRAH DIVISION \(HWH\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Eastern Railway/i)).toBeInTheDocument();
      expect(screen.getByText("Planner Demo")).toBeInTheDocument();
      expect(screen.getByText("PLANNER")).toBeInTheDocument();
    });
  });

  it("displays KPI cards with API-derived metrics", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <DashboardPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      // Total tasks
      expect(screen.getByText("53")).toBeInTheDocument();
      // Opportunities
      expect(screen.getByText("404")).toBeInTheDocument();
      // Candidate blocks
      expect(screen.getByText("15,652")).toBeInTheDocument();
      // Tasks scheduled / considered
      expect(screen.getByText("/53")).toBeInTheDocument();
      // Integrated blocks (appears in KPI card and Latest Run card)
      expect(screen.getAllByText("15").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders priority & severity distribution breakdown", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <DashboardPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Defect Severity & Priority Distribution/i)).toBeInTheDocument();
      expect(screen.getByText("Immediate safety / track speed restriction risk")).toBeInTheDocument();
      expect(screen.getByText("Baseline Priority")).toBeInTheDocument();
    });
  });

  it("displays top maintenance queue with priority score and overdue days", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <DashboardPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText("WO-0001").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("WO-0002").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("95.50").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("6d")).toBeInTheDocument();
      expect(screen.getAllByText("Priority Score").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("displays cross-department integration opportunities with compatibility score", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <DashboardPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("OPP-HOW_SEC_001-WO-0001-WO-0002")).toBeInTheDocument();
      expect(screen.getByText("100%")).toBeInTheDocument();
      expect(screen.getAllByText("177.80").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("displays latest optimization run and solver status", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <DashboardPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("RUN-TEST-001")).toBeInTheDocument();
      expect(screen.getByText("Optimal")).toBeInTheDocument();
      expect(screen.getByText("7115.39")).toBeInTheDocument();
    });
  });

  it("displays realized priority value explicitly on recent optimized blocks", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <DashboardPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("OPT-CAND-HOW_SEC_001-CW-0001-OPP-1")).toBeInTheDocument();
      expect(screen.getAllByText("177.80").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Recent Optimized Possession Blocks/i)).toBeInTheDocument();
    });
  });

  it("renders empty state for optimization run when no runs exist", async () => {
    vi.spyOn(optimizationApi, "getOptimizationRuns").mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 1,
      total_pages: 0,
    });

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <DashboardPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("No optimization plan generated yet.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /open optimization/i })).toBeInTheDocument();
    });
  });

  it("handles partial failure gracefully without crashing the whole dashboard", async () => {
    vi.spyOn(optimizationApi, "getOptimizationRuns").mockRejectedValue(
      new Error("Network connection timeout")
    );

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <DashboardPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      // Optimization section shows error state
      expect(screen.getByText("Failed to load optimization run")).toBeInTheDocument();
      // But maintenance queue still renders fine
      expect(screen.getByText("WO-0001")).toBeInTheDocument();
      // And KPI still renders fine
      expect(screen.getByText("53")).toBeInTheDocument();
    });
  });

  it("shows planning & optimization action buttons for PLANNER role", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <DashboardPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /open planning/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /optimization engine/i })).toBeInTheDocument();
    });
  });

  it("hides planning & optimization action buttons for VIEWER role", async () => {
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
        <DashboardPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /open planning/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /optimization engine/i })).toBeNull();
      expect(screen.getByTitle(/refresh live operational data/i)).toBeInTheDocument();
    });
  });
});
