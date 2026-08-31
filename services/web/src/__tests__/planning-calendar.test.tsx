import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PlanningCalendarPage from "@/app/planning/calendar/page";
import { WeekView } from "@/components/planning/calendar/week-view";
import { MonthView } from "@/components/planning/calendar/month-view";
import { ScheduleTimelineView } from "@/components/planning/calendar/schedule-timeline-view";
import { UnassignedTasksAlert } from "@/components/planning/calendar/unassigned-tasks-alert";
import * as optimizationApi from "@/lib/api/optimization";
import * as sectionsApi from "@/lib/api/sections";
import * as reactOidcContext from "react-oidc-context";

vi.mock("next/navigation", () => ({
  usePathname: () => "/planning/calendar",
  useSearchParams: () => new URLSearchParams("run=1&view=week"),
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
    run_type: "production",
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
    total_blocks_scheduled: 12,
    estimated_total_block_hours: 48.5,
    unassigned_task_ids: ["WO-0010", "WO-0011", "WO-0012"],
    warnings: [],
    notes: "Howrah Main Corridor 7-day plan",
    created_at: "2026-08-31T18:00:00Z",
  },
];

const mockBlocks = [
  {
    id: 101,
    optimization_run_id: 1,
    optimized_block_id: "OPT-BLK-0001",
    candidate_id: "CAND-0001",
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
    estimated_impact_score: 14.2,
    resource_status: "UNVERIFIED",
    freight_impact: "LOW",
    task_ids: ["WO-0001", "WO-0002"],
    status: "Candidate",
    explanation: null,
    created_at: "2026-08-31T18:00:00Z",
  },
  {
    id: 102,
    optimization_run_id: 1,
    optimized_block_id: "OPT-BLK-0002",
    candidate_id: "CAND-0002",
    section_id: "HOW_SEC_002",
    block_start: "2026-09-02T01:00:00Z",
    block_end: "2026-09-02T04:00:00Z",
    block_duration_hrs: 3.0,
    block_type: "single",
    is_integrated: false,
    departments_involved: ["TRD"],
    realized_priority_value: 92.5,
    candidate_priority_value: 92.5,
    train_conflicts: 0,
    estimated_impact_score: 8.0,
    resource_status: "UNVERIFIED",
    freight_impact: "NONE",
    task_ids: ["WO-0003"],
    status: "Candidate",
    explanation: null,
    created_at: "2026-08-31T18:00:00Z",
  },
];

const mockSections = [
  {
    section_id: "HOW_SEC_001",
    section_name: "Howrah - Dankuni Chord",
    from_station_code: "HWH",
    to_station_code: "DKAE",
    route_km: 14.8,
    track_count: 2,
    line_type: "Main",
    electrified: true,
    signalling_system: "Automatic Block Signalling",
    division_id: 1,
    source_type: "Official",
  },
  {
    section_id: "HOW_SEC_002",
    section_name: "Dankuni - Chandanpur",
    from_station_code: "DKAE",
    to_station_code: "CDAE",
    route_km: 22.4,
    track_count: 2,
    line_type: "Main",
    electrified: true,
    signalling_system: "Automatic Block Signalling",
    division_id: 1,
    source_type: "Official",
  },
];

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  });
}

describe("Weekly / Monthly Maintenance Planning Workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (reactOidcContext.useAuth as any).mockReturnValue({
      isAuthenticated: true,
      user: {
        profile: {
          sub: "user-123",
          preferred_username: "planner_hwh",
          realm_access: { roles: ["PLANNER"] },
        },
      },
    });

    vi.spyOn(optimizationApi, "getOptimizationRuns").mockResolvedValue({
      items: mockRuns as any,
      total: 1,
      page: 1,
      page_size: 10,
      total_pages: 1,
    });

    vi.spyOn(optimizationApi, "getOptimizationRun").mockResolvedValue(mockRuns[0] as any);

    vi.spyOn(optimizationApi, "getOptimizedBlocks").mockResolvedValue({
      items: mockBlocks as any,
      total: 2,
      page: 1,
      page_size: 100,
      total_pages: 1,
    });

    vi.spyOn(sectionsApi, "getSections").mockResolvedValue({
      items: mockSections as any,
      total: 2,
      page: 1,
      page_size: 100,
      total_pages: 1,
    });
  });

  it("renders planning calendar with Howrah Division headers, active run, and disclaimer", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <PlanningCalendarPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Corridor Maintenance Schedule & Calendar")).toBeInTheDocument();
      expect(screen.getByText("HOWRAH DIVISION (HWH)")).toBeInTheDocument();
      expect(screen.getByText(/Optimization result — requires human planning & operational review/i)).toBeInTheDocument();
      expect(screen.getByText("Week View")).toBeInTheDocument();
      expect(screen.getByText("Month View")).toBeInTheDocument();
      expect(screen.getByText("Schedule View")).toBeInTheDocument();
    });
  });

  it("renders WeekView with Mon-Sun columns and optimized block cards", () => {
    const onSelectBlock = vi.fn();
    const currentWeekStart = new Date(Date.UTC(2026, 7, 31)); // Mon 31 Aug 2026

    render(
      <WeekView
        currentWeekStart={currentWeekStart}
        blocks={mockBlocks as any}
        selectedBlockId={null}
        onSelectBlock={onSelectBlock}
      />
    );

    expect(screen.getByText("Mon")).toBeInTheDocument();
    expect(screen.getByText("Tue")).toBeInTheDocument();
    expect(screen.getByText("Wed")).toBeInTheDocument();
    expect(screen.getByText("OPT-BLK-0001")).toBeInTheDocument();
    expect(screen.getByText("OPT-BLK-0002")).toBeInTheDocument();
    expect(screen.getByText("177.80")).toBeInTheDocument();
    expect(screen.getByText("92.50")).toBeInTheDocument();
    expect(screen.getByText("HOW_SEC_001")).toBeInTheDocument();
    expect(screen.getByText("HOW_SEC_002")).toBeInTheDocument();

    const blockCard = screen.getByRole("button", { name: /Block OPT-BLK-0001/i });
    fireEvent.click(blockCard);
    expect(onSelectBlock).toHaveBeenCalledWith(mockBlocks[0]);
  });

  it("renders MonthView with calendar grid and selected day block list", () => {
    const onSelectBlock = vi.fn();
    const currentMonthDate = new Date(Date.UTC(2026, 8, 1)); // Sep 2026

    render(
      <MonthView
        currentMonthDate={currentMonthDate}
        blocks={mockBlocks as any}
        selectedBlockId={null}
        onSelectBlock={onSelectBlock}
      />
    );

    expect(screen.getByText("Mon")).toBeInTheDocument();
    expect(screen.getByText("Sun")).toBeInTheDocument();
    expect(screen.getByText("Scheduled Possessions for Date:")).toBeInTheDocument();
    expect(screen.getByText("OPT-BLK-0001")).toBeInTheDocument();
  });

  it("renders ScheduleTimelineView grouped by corridor sections", () => {
    const onSelectBlock = vi.fn();

    render(
      <ScheduleTimelineView
        blocks={mockBlocks as any}
        selectedBlockId={null}
        onSelectBlock={onSelectBlock}
      />
    );

    expect(screen.getByText("Section: HOW_SEC_001")).toBeInTheDocument();
    expect(screen.getByText("Section: HOW_SEC_002")).toBeInTheDocument();
    expect(screen.getByText("OPT-BLK-0001")).toBeInTheDocument();
    expect(screen.getByText("OPT-BLK-0002")).toBeInTheDocument();
    expect(screen.getByText("177.80")).toBeInTheDocument();
  });

  it("renders UnassignedTasksAlert with expandable work orders and workbench link", () => {
    render(
      <UnassignedTasksAlert
        unassignedCount={30}
        unassignedTaskIds={["WO-0010", "WO-0011"]}
      />
    );

    expect(
      screen.getByText("30 Maintenance Tasks were not assigned by the solver")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Open Maintenance Workbench/i })
    ).toHaveAttribute("href", "/maintenance");

    const expandBtn = screen.getByRole("button", { name: /Show Task List/i });
    fireEvent.click(expandBtn);

    expect(screen.getByText("WO-0010")).toBeInTheDocument();
    expect(screen.getByText("WO-0011")).toBeInTheDocument();
  });

  it("handles empty optimization runs gracefully", async () => {
    vi.spyOn(optimizationApi, "getOptimizationRuns").mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 10,
      total_pages: 0,
    });

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <PlanningCalendarPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("No Optimization Plans Available")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Open Optimization Planner/i })).toHaveAttribute(
        "href",
        "/optimization"
      );
    });
  });
});
