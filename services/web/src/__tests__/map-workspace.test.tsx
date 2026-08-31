import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MapPage from "@/app/map/page";
import { MapLegend } from "@/components/map/map-legend";
import { MapFilters } from "@/components/map/map-filters";
import { MapSelectedDetail } from "@/components/map/map-selected-detail";
import * as stationsApi from "@/lib/api/stations";
import * as sectionsApi from "@/lib/api/sections";
import * as maintenanceApi from "@/lib/api/maintenance";
import * as candidatesApi from "@/lib/api/candidate-blocks";
import * as optimizationApi from "@/lib/api/optimization";

vi.mock("next/navigation", () => ({
  usePathname: () => "/map",
  useSearchParams: () => new URLSearchParams("section=HOW_SEC_001&run=1"),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

// Mock Leaflet methods to prevent JSDOM canvas/DOM issues
vi.mock("leaflet", () => {
  const layerGroupMock = {
    addTo: vi.fn().mockReturnThis(),
    addLayer: vi.fn().mockReturnThis(),
    clearLayers: vi.fn().mockReturnThis(),
  };

  return {
    default: {
      map: vi.fn(() => ({
        remove: vi.fn(),
        fitBounds: vi.fn(),
        setView: vi.fn(),
      })),
      tileLayer: vi.fn(() => ({
        addTo: vi.fn().mockReturnThis(),
      })),
      layerGroup: vi.fn(() => layerGroupMock),
      latLngBounds: vi.fn(() => ({
        pad: vi.fn(),
      })),
      latLng: vi.fn((lat, lng) => ({ lat, lng })),
      polyline: vi.fn(() => ({
        bindTooltip: vi.fn().mockReturnThis(),
        on: vi.fn().mockReturnThis(),
      })),
      marker: vi.fn(() => ({
        bindTooltip: vi.fn().mockReturnThis(),
        on: vi.fn().mockReturnThis(),
      })),
      divIcon: vi.fn((opts) => opts),
      DomEvent: {
        stopPropagation: vi.fn(),
      },
    },
  };
});

const mockStations = [
  {
    station_code: "HWH",
    station_name: "Howrah Junction",
    station_type: "Terminal",
    block_station: true,
    ibp: false,
    flag_station: false,
    halt: false,
    platform_available: true,
    latitude: 22.5839,
    longitude: 88.3426,
    division: "Howrah",
    zone: "ER",
    out_of_division_station: false,
    administrative_division: "Howrah",
    scope_note: "Major terminal hub",
    source_type: "Official",
  },
  {
    station_code: "DKAE",
    station_name: "Dankuni Junction",
    station_type: "Junction",
    block_station: true,
    ibp: false,
    flag_station: false,
    halt: false,
    platform_available: true,
    latitude: 22.6784,
    longitude: 88.2912,
    division: "Howrah",
    zone: "ER",
    out_of_division_station: false,
    administrative_division: "Howrah",
    scope_note: "Freight interchange node",
    source_type: "Official",
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
];

const mockTasks = [
  {
    task_id: "WO-0001",
    asset_id: "AST-001",
    section_id: "HOW_SEC_001",
    department: "Engineering",
    defect_type: "Deep screening and ballast tamping",
    severity: "Critical",
    reported_date: "2026-08-25T00:00:00Z",
    days_overdue: 5,
    required_duration_hrs: 4.0,
    postpone_penalty_cost: 1200,
    priority_score: 85.5,
    status: "Open",
    source_type: "Official",
  },
];

const mockCandidates = [
  {
    candidate_id: "CAND-0001",
    section_id: "HOW_SEC_001",
    window_id: "WIN-001",
    candidate_start: "2026-09-01T02:00:00Z",
    candidate_end: "2026-09-01T06:00:00Z",
    required_duration_hrs: 4.0,
    task_ids: ["WO-0001"],
    departments_involved: ["Engineering"],
    feasibility_status: "FEASIBLE",
    train_conflicts: 0,
    priority_score: 85.5,
    reasons: ["Optimal night window"],
  },
];

const mockOptimizedBlocks = [
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
    estimated_impact_score: 12.5,
    resource_status: "UNVERIFIED",
    freight_impact: "LOW",
    task_ids: ["WO-0001", "WO-0002"],
    status: "Candidate",
    explanation: null,
    created_at: "2026-08-31T18:00:00Z",
  },
];

const mockRuns = [
  {
    id: 1,
    run_id: "RUN-0001",
    created_at: "2026-08-31T18:00:00Z",
    planning_horizon_start: "2026-08-31T00:00:00Z",
    planning_horizon_end: "2026-09-06T23:59:59Z",
    solver_status: "OPTIMAL",
    total_objective_value: 3840.5,
    solve_time_seconds: 4.12,
    tasks_considered: 53,
    tasks_scheduled: 23,
    tasks_unassigned: 30,
    total_blocks_scheduled: 12,
    integrated_block_count: 5,
    separate_block_count: 7,
    estimated_total_block_hours: 48.5,
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

describe("Interactive Railway Network Map Workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(stationsApi, "getStations").mockResolvedValue({
      items: mockStations as any,
      total: 2,
      page: 1,
      page_size: 100,
      total_pages: 1,
    });
    vi.spyOn(sectionsApi, "getSections").mockResolvedValue({
      items: mockSections as any,
      total: 1,
      page: 1,
      page_size: 100,
      total_pages: 1,
    });
    vi.spyOn(maintenanceApi, "getMaintenanceTasks").mockResolvedValue({
      items: mockTasks as any,
      total: 1,
      page: 1,
      page_size: 100,
      total_pages: 1,
    });
    vi.spyOn(candidatesApi, "getCandidateBlocks").mockResolvedValue({
      items: mockCandidates as any,
      total: 1,
      page: 1,
      page_size: 100,
      total_pages: 1,
    });
    vi.spyOn(optimizationApi, "getOptimizationRuns").mockResolvedValue({
      items: mockRuns as any,
      total: 1,
      page: 1,
      page_size: 10,
      total_pages: 1,
    });
    vi.spyOn(optimizationApi, "getOptimizedBlocks").mockResolvedValue({
      items: mockOptimizedBlocks as any,
      total: 1,
      page: 1,
      page_size: 100,
      total_pages: 1,
    });
  });

  it("renders full map workspace with Howrah Division headers and KPI counts", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MapPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Interactive Railway Network Map")).toBeInTheDocument();
      expect(screen.getByText("HOWRAH DIVISION (HWH)")).toBeInTheDocument();
      expect(screen.getByText("Eastern Railway")).toBeInTheDocument();
      expect(screen.getByText("Spatial & Operational Filters")).toBeInTheDocument();
      expect(screen.getByText("Map Layers & Legend")).toBeInTheDocument();
    });
  });

  it("renders layer legend and allows toggling layer visibility", () => {
    const onToggleLayer = vi.fn();
    const onToggleAll = vi.fn();
    const layers = {
      stations: true,
      sections: true,
      maintenance: true,
      candidates: true,
      optimized: true,
    };
    const counts = {
      stations: 35,
      sections: 9,
      maintenance: 53,
      candidates: 82,
      optimized: 12,
    };

    render(
      <MapLegend
        layers={layers}
        counts={counts}
        onToggleLayer={onToggleLayer}
        onToggleAll={onToggleAll}
      />
    );

    expect(screen.getByText("Stations")).toBeInTheDocument();
    expect(screen.getByText("Railway Sections")).toBeInTheDocument();
    expect(screen.getByText("Maintenance Tasks")).toBeInTheDocument();
    expect(screen.getByText("Candidate Blocks")).toBeInTheDocument();
    expect(screen.getByText("Optimized Blocks")).toBeInTheDocument();
    expect(screen.getByText("35")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();

    const hideAllBtn = screen.getByRole("button", { name: /Hide All/i });
    fireEvent.click(hideAllBtn);
    expect(onToggleAll).toHaveBeenCalledWith(false);
  });

  it("renders filter controls and dispatches filter updates", () => {
    const onFilterChange = vi.fn();
    const onResetFilters = vi.fn();
    const filters = {
      sectionId: "HOW_SEC_001",
      department: "",
      severity: "",
      status: "",
      integratedOnly: false,
      runId: "",
    };

    render(
      <MapFilters
        filters={filters}
        onFilterChange={onFilterChange}
        onResetFilters={onResetFilters}
        availableSections={[{ section_id: "HOW_SEC_001", section_name: "Howrah - Dankuni Chord" }]}
        availableRuns={[{ id: 1, run_id: "RUN-0001", solver_status: "OPTIMAL" }]}
      />
    );

    expect(screen.getByLabelText("Filter by Railway Section")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by Department")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by Severity")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by Maintenance Status")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by Optimization Run")).toBeInTheDocument();

    const deptSelect = screen.getByLabelText("Filter by Department");
    fireEvent.change(deptSelect, { target: { value: "Engineering" } });
    expect(onFilterChange).toHaveBeenCalledWith(expect.objectContaining({ department: "Engineering" }));
  });

  it("renders Station detail in selected detail panel", () => {
    render(
      <MapSelectedDetail
        selection={{ type: "station", data: mockStations[0] }}
        onClearSelection={vi.fn()}
      />
    );

    expect(screen.getByText("Howrah Junction (HWH)")).toBeInTheDocument();
    expect(screen.getByText("Terminal")).toBeInTheDocument();
    expect(screen.getByText("22.5839, 88.3426")).toBeInTheDocument();
  });

  it("renders Section detail with route navigation in selected detail panel", () => {
    render(
      <MapSelectedDetail
        selection={{ type: "section", data: mockSections[0] }}
        onClearSelection={vi.fn()}
      />
    );

    expect(screen.getByText("Howrah - Dankuni Chord (HOW_SEC_001)")).toBeInTheDocument();
    expect(screen.getByText("14.8 km")).toBeInTheDocument();
    expect(screen.getByText("Automatic Block Signalling")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View Candidate Blocks/i })).toHaveAttribute(
      "href",
      "/planning?section=HOW_SEC_001"
    );
  });

  it("renders Maintenance Task detail with workbench link", () => {
    render(
      <MapSelectedDetail
        selection={{ type: "maintenance", data: mockTasks[0] }}
        onClearSelection={vi.fn()}
      />
    );

    expect(screen.getByText("Work Order: WO-0001")).toBeInTheDocument();
    expect(screen.getByText("Engineering")).toBeInTheDocument();
    expect(screen.getByText("85.50")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open in Maintenance Workbench/i })).toHaveAttribute(
      "href",
      "/maintenance"
    );
  });

  it("renders Candidate Block detail with planning workspace link", () => {
    render(
      <MapSelectedDetail
        selection={{ type: "candidate", data: mockCandidates[0] }}
        onClearSelection={vi.fn()}
      />
    );

    expect(screen.getByText("Candidate Window: CAND-0001")).toBeInTheDocument();
    expect(screen.getByText("HOW_SEC_001")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Inspect in Planning Workspace/i })).toHaveAttribute(
      "href",
      "/planning"
    );
  });

  it("renders Optimized Block detail with realized priority and optimization run link", () => {
    render(
      <MapSelectedDetail
        selection={{ type: "optimized", data: mockOptimizedBlocks[0] }}
        onClearSelection={vi.fn()}
      />
    );

    expect(screen.getByText("Optimized Block: OPT-BLK-0001")).toBeInTheDocument();
    expect(screen.getByText("177.80")).toBeInTheDocument();
    expect(screen.getByText("165.00")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View Full Optimization Plan/i })).toHaveAttribute(
      "href",
      "/optimization/runs/1"
    );
  });
});
