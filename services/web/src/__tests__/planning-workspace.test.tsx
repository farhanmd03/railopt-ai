import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PlanningPage from "@/app/planning/page";
import * as reactOidcContext from "react-oidc-context";
import * as maintenanceApi from "@/lib/api/maintenance";
import * as candidateBlocksApi from "@/lib/api/candidate-blocks";

vi.mock("next/navigation", () => ({
  usePathname: () => "/planning",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock("react-oidc-context", () => ({
  useAuth: vi.fn(),
}));

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
    compatibility_reasons: ["Co-located on HOW_SEC_001", "Compatible safety clearances"],
  },
  {
    opportunity_id: "OPP-HOW_SEC_002-WO-0003",
    section_id: "HOW_SEC_002",
    task_ids: ["WO-0003"],
    departments_involved: ["TRD"],
    is_cross_department: false,
    compatibility_status: "COMPATIBLE",
    compatibility_score: 100.0,
    combined_duration_hrs: 3.0,
    priority_summary: {
      highest_task_priority: 64.1,
      average_task_priority: 64.1,
      total_priority_value: 64.1,
    },
    compatibility_reasons: ["Single department OHE window"],
  },
];

const mockCandidates = [
  {
    candidate_id: "CAND-HOW_SEC_001-CW-0001-WO-0001",
    opportunity_id: "OPP-HOW_SEC_001-WO-0001-WO-0002",
    section_id: "HOW_SEC_001",
    window_id: "CW-0001",
    candidate_start: "2026-09-01T02:00:00Z",
    candidate_end: "2026-09-01T06:30:00Z",
    required_duration_hrs: 4.5,
    window_duration_hrs: 5.0,
    computed_feasibility_status: "FEASIBLE",
    train_conflict: false,
    train_conflict_count: 0,
    freight_level: "LOW",
    resource_check: "UNVERIFIED",
    priority_score: 95.5,
    departments_involved: ["Engineering", "S&T"],
    task_ids: ["WO-0001", "WO-0002"],
    reasons: ["Window provides 5.0h for required 4.5h task", "No train timetable clash"],
  },
  {
    candidate_id: "CAND-HOW_SEC_002-CW-0002-WO-0003",
    opportunity_id: null,
    section_id: "HOW_SEC_002",
    window_id: "CW-0002",
    candidate_start: "2026-09-01T10:00:00Z",
    candidate_end: "2026-09-01T13:00:00Z",
    required_duration_hrs: 3.0,
    window_duration_hrs: 3.0,
    computed_feasibility_status: "TRAIN_CONFLICT",
    train_conflict: true,
    train_conflict_count: 2,
    freight_level: null, // tests "Not available" fallback
    resource_check: "UNVERIFIED",
    priority_score: 64.1,
    departments_involved: ["TRD"],
    task_ids: ["WO-0003"],
    reasons: ["Overlaps with freight corridor path"],
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

describe("Integration & Candidate Planning Workspace", () => {
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

    vi.spyOn(maintenanceApi, "getIntegrationOpportunities").mockImplementation(
      async (params) => {
        if (params?.cross_department) {
          return {
            items: mockOpportunities.filter((o) => o.is_cross_department),
            total: 240,
            page: params?.page || 1,
            page_size: params?.page_size || 1,
            total_pages: 240,
          };
        }
        return {
          items: mockOpportunities,
          total: 404,
          page: params?.page || 1,
          page_size: params?.page_size || 8,
          total_pages: 51,
        };
      }
    );

    vi.spyOn(candidateBlocksApi, "getCandidateBlocks").mockImplementation(
      async (params) => {
        if (params?.feasibility_status === "FEASIBLE") {
          return {
            items: mockCandidates.filter(
              (c) => c.computed_feasibility_status === "FEASIBLE"
            ),
            total: 12840,
            page: params?.page || 1,
            page_size: params?.page_size || 1,
            total_pages: 12840,
          };
        }
        return {
          items: mockCandidates,
          total: 15652,
          page: params?.page || 1,
          page_size: params?.page_size || 8,
          total_pages: 1957,
        };
      }
    );

    vi.spyOn(maintenanceApi, "getMaintenanceTasks").mockResolvedValue({
      items: [],
      total: 53,
      page: 1,
      page_size: 100,
      total_pages: 1,
    });
  });

  it("renders planning header with title and authenticated user", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <PlanningPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Integration & Candidate Planning/i)).toBeInTheDocument();
      expect(screen.getByText(/HOWRAH DIVISION \(HWH\)/i)).toBeInTheDocument();
      expect(screen.getByText("Planner Demo")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /open optimization planner/i })).toBeInTheDocument();
    });
  });

  it("renders opportunity overview strip with API counts", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <PlanningPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Integration Opportunities")).toBeInTheDocument();
      expect(screen.getAllByText("404").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Cross-Department")).toBeInTheDocument();
      expect(screen.getByText("240")).toBeInTheDocument();
      expect(screen.getByText("Candidate Blocks")).toBeInTheDocument();
      expect(screen.getAllByText("15,652").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("12,840")).toBeInTheDocument();
    });
  });

  it("renders integration opportunities table with departments and compatibility", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <PlanningPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("OPP-HOW_SEC_001-WO-0001-WO-0002")).toBeInTheDocument();
      expect(screen.getAllByText("100%").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("177.80")).toBeInTheDocument();
    });
  });

  it("opens opportunity detail drawer on row click and shows advisory note", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <PlanningPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("OPP-HOW_SEC_001-WO-0001-WO-0002")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("OPP-HOW_SEC_001-WO-0001-WO-0002"));

    await waitFor(() => {
      expect(screen.getByText("Planning Screening Signal")).toBeInTheDocument();
      expect(screen.getByText("Co-Located Integrated Block Candidate")).toBeInTheDocument();
      expect(screen.getByText("Co-located on HOW_SEC_001")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /explore window candidates/i })
      ).toBeInTheDocument();
    });
  });

  it("renders candidate block explorer with Candidate Priority and Feasibility", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <PlanningPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("CAND-HOW_SEC_001-CW-0001-WO-0001")).toBeInTheDocument();
      expect(screen.getByText("CAND-HOW_SEC_002-CW-0002-WO-0003")).toBeInTheDocument();
      expect(screen.getAllByText("Candidate Priority").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("UNVERIFIED").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("opens candidate detail drawer and verifies accurate constraint information", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <PlanningPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("CAND-HOW_SEC_002-CW-0002-WO-0003")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("CAND-HOW_SEC_002-CW-0002-WO-0003"));

    await waitFor(() => {
      expect(screen.getByText("Computational Candidate Option")).toBeInTheDocument();
      expect(screen.getByText("2 Conflict(s)")).toBeInTheDocument();
      // Freight unavailable fallback
      expect(screen.getByText("Not available")).toBeInTheDocument();
      // Resource unverified
      expect(screen.getByText("Resource: UNVERIFIED")).toBeInTheDocument();
    });
  });

  it("filters candidate block explorer when clicking Explore Window Candidates from opportunity drawer", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <PlanningPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("OPP-HOW_SEC_001-WO-0001-WO-0002")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("OPP-HOW_SEC_001-WO-0001-WO-0002"));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /explore window candidates/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /explore window candidates/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Filtered for Opportunity:/i)
      ).toBeInTheDocument();
    });
  });

  it("hides Open Optimization Planner button for VIEWER role", async () => {
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
        <PlanningPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /open optimization planner/i })).toBeNull();
      expect(screen.getByTitle(/refresh planning data/i)).toBeInTheDocument();
    });
  });
});
