import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MaintenancePage from "@/app/maintenance/page";
import * as reactOidcContext from "react-oidc-context";
import * as maintenanceApi from "@/lib/api/maintenance";
import { PriorityAssessment } from "@/lib/types/maintenance";

vi.mock("next/navigation", () => ({
  usePathname: () => "/maintenance",
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
    status: "InProgress",
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
    status: "Completed",
    source_type: "Routine",
  },
];

const mockPriorityAssessment: PriorityAssessment = {
  task_id: "WO-0001",
  asset_id: "TRK-HWH-01",
  section_id: "HOW_SEC_001",
  department: "Engineering",
  defect_type: "Rail Fracture",
  severity: "Critical",
  days_overdue: 6,
  computed_priority_score: 96.8,
  baseline_priority_score: 95.5,
  priority_band: "CRITICAL",
  components: {
    severity_component: 100.0,
    overdue_component: 60.0,
    criticality_component: 90.0,
    failure_risk_component: 95.0,
  },
  reasons: [
    "Critical defect severity assigns maximum 100.0 baseline",
    "Asset TRK-HWH-01 has high criticality index",
  ],
};

const mockTaskOpportunities = [
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
    compatibility_reasons: ["Co-located on HOW_SEC_001", "Compatible department safety rules"],
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

describe("Maintenance Workbench Page", () => {
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

    vi.spyOn(maintenanceApi, "getTaskPriority").mockResolvedValue(mockPriorityAssessment);
    vi.spyOn(maintenanceApi, "getTaskIntegrationOpportunities").mockResolvedValue(
      mockTaskOpportunities
    );
  });

  it("renders workbench header with division metadata and authenticated user", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MaintenancePage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/HOWRAH DIVISION \(HWH\)/i)).toBeInTheDocument();
      expect(screen.getByText("Planner Demo")).toBeInTheDocument();
      expect(screen.getByText("PLANNER")).toBeInTheDocument();
      expect(
        screen.getByText("Maintenance Management & Defect Workbench")
      ).toBeInTheDocument();
    });
  });

  it("renders summary strip with API-derived counts", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MaintenancePage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Total Work Orders")).toBeInTheDocument();
      expect(screen.getByText("53")).toBeInTheDocument(); // total tasks
      expect(screen.getByText("Critical Severity")).toBeInTheDocument();
      expect(screen.getByText("High Severity")).toBeInTheDocument();
      expect(screen.getByText("Overdue Backlog")).toBeInTheDocument();
      expect(screen.getByText("Open / In Progress")).toBeInTheDocument();
    });
  });

  it("renders maintenance tasks table with real data and Priority Score header", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MaintenancePage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("WO-0001")).toBeInTheDocument();
      expect(screen.getByText("Rail Fracture")).toBeInTheDocument();
      expect(screen.getByText("WO-0002")).toBeInTheDocument();
      expect(screen.getByText("Signal Lamp Failure")).toBeInTheDocument();
      expect(screen.getAllByText("Priority Score").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("95.50")).toBeInTheDocument();
    });
  });

  it("filters tasks by search query", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MaintenancePage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("WO-0001")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search task id, defect, asset/i);
    fireEvent.change(searchInput, { target: { value: "Catenary" } });

    await waitFor(() => {
      expect(screen.getByText("WO-0003")).toBeInTheDocument();
      expect(screen.getByText("Catenary Sag")).toBeInTheDocument();
      expect(screen.queryByText("Rail Fracture")).toBeNull();
    });
  });

  it("filters tasks by overdue toggle", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MaintenancePage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("WO-0001")).toBeInTheDocument();
      expect(screen.getByText("WO-0003")).toBeInTheDocument();
    });

    const overdueCheckbox = screen.getByLabelText(/show overdue backlog only/i);
    fireEvent.click(overdueCheckbox);

    await waitFor(() => {
      // WO-0001 (6d) and WO-0002 (3d) are overdue; WO-0003 and WO-0004 are not
      expect(screen.getByText("WO-0001")).toBeInTheDocument();
      expect(screen.getByText("WO-0002")).toBeInTheDocument();
      expect(screen.queryByText("WO-0003")).toBeNull();
      expect(screen.queryByText("WO-0004")).toBeNull();
    });
  });

  it("resets filters when clicking Reset Filters", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MaintenancePage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("WO-0001")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search task id, defect, asset/i);
    fireEvent.change(searchInput, { target: { value: "NonExistentDefect" } });

    await waitFor(() => {
      expect(screen.getByText("No maintenance tasks match your filters")).toBeInTheDocument();
    });

    const resetButton = screen.getByRole("button", { name: /reset filters/i });
    fireEvent.click(resetButton);

    await waitFor(() => {
      expect(screen.getByText("WO-0001")).toBeInTheDocument();
      expect(screen.getByText("WO-0002")).toBeInTheDocument();
    });
  });

  it("opens task detail drawer on row click and loads priority assessment on demand", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MaintenancePage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("WO-0001")).toBeInTheDocument();
    });

    // Priority API is NOT called yet for WO-0001
    expect(maintenanceApi.getTaskPriority).not.toHaveBeenCalled();

    // Click row
    fireEvent.click(screen.getByText("WO-0001"));

    await waitFor(() => {
      expect(maintenanceApi.getTaskPriority).toHaveBeenCalledWith("WO-0001");
      expect(maintenanceApi.getTaskIntegrationOpportunities).toHaveBeenCalledWith("WO-0001");

      // Verify Baseline Priority vs Computed Planning Priority distinction
      expect(screen.getByText("Baseline Priority")).toBeInTheDocument();
      expect(screen.getByText("Computed Planning Priority")).toBeInTheDocument();
      expect(screen.getByText("96.80")).toBeInTheDocument(); // computed score
      expect(screen.getByText("CRITICAL")).toBeInTheDocument(); // band

      // Verify reasons
      expect(
        screen.getByText("Critical defect severity assigns maximum 100.0 baseline")
      ).toBeInTheDocument();

      // Verify potential integration opportunity section
      expect(screen.getByText("Potential Integration Opportunities")).toBeInTheDocument();
      expect(screen.getByText("OPP-HOW_SEC_001-WO-0001-WO-0002")).toBeInTheDocument();
      expect(screen.getByText("100% Compatible")).toBeInTheDocument();
    });

    // Close drawer
    const closeBtn = screen.getByRole("button", { name: /close panel/i });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByText("Baseline Priority")).toBeNull();
    });
  });

  it("shows Open Planning action for PLANNER role and hides for VIEWER role", async () => {
    const queryClient = createTestQueryClient();
    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <MaintenancePage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /open planning/i })).toBeInTheDocument();
    });

    unmount();

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

    const queryClient2 = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient2}>
        <MaintenancePage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /open planning/i })).toBeNull();
      expect(screen.getByTitle(/refresh maintenance data/i)).toBeInTheDocument();
    });
  });

  it("handles error state without crashing", async () => {
    vi.spyOn(maintenanceApi, "getMaintenanceTasks").mockRejectedValue(
      new Error("Database connection failed")
    );

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MaintenancePage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Failed to load maintenance tasks")).toBeInTheDocument();
    });
  });
});
