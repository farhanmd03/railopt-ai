import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OptimizedBlockDetailDrawer } from "@/components/optimization/optimized-block-detail-drawer";
import * as reactOidcContext from "react-oidc-context";
import * as optimizationApi from "@/lib/api/optimization";
import { OptimizedBlock } from "@/lib/types/optimization";

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

const mockBlock: OptimizedBlock = {
  id: 101,
  optimization_run_id: 1,
  optimized_block_id: "OPT-BLK-0001",
  candidate_id: "CAND-001",
  section_id: "NDLS-GZB-01",
  block_start: "2026-09-01T02:00:00Z",
  block_end: "2026-09-01T06:00:00Z",
  block_duration_hrs: 4.0,
  block_type: "integrated",
  is_integrated: true,
  departments_involved: ["Engineering", "S&T", "TRD"],
  realized_priority_value: 180.0,
  candidate_priority_value: 170.0,
  train_conflicts: 0,
  estimated_impact_score: null,
  resource_status: "VERIFIED",
  freight_impact: "LOW",
  task_ids: ["WO-0001", "WO-0002"],
  status: "Candidate",
  explanation: null,
  created_at: "2026-08-31T12:00:00Z",
};

const mockFinalizedBlock: OptimizedBlock = {
  ...mockBlock,
  id: 102,
  status: "APPROVED",
};

const mockNegotiationLogs = [
  {
    id: 1,
    optimized_block_id: 101,
    department: "ENGINEERING",
    action: "ACCEPT" as const,
    comment: "P-Way team accepts 4h window",
    adjustment_category: null,
    adjustment_payload: null,
    performed_by: "engg.demo",
    timestamp: "2026-09-01T03:00:00Z",
  },
  {
    id: 2,
    optimized_block_id: 101,
    department: "TRD",
    action: "ADJUST" as const,
    comment: "Shift required for isolator maintenance",
    adjustment_category: "TIME_CHANGE" as const,
    adjustment_payload: {
      value: "Shift start to 02:30 UTC",
      reason: "OHE isolator maintenance alignment",
    },
    performed_by: "trd.demo",
    timestamp: "2026-09-01T03:15:00Z",
  },
];

describe("Multi-Department Negotiation in OptimizedBlockDetailDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(optimizationApi, "getBlockReadiness").mockResolvedValue({
      block_id: 101,
      readiness: "GO",
      summary: "Ready for possession",
      checks: [],
      human_decision_required: true,
    });

    vi.spyOn(optimizationApi, "getBlockNegotiations").mockResolvedValue(mockNegotiationLogs);
    vi.spyOn(optimizationApi, "negotiateBlock").mockResolvedValue({
      id: 3,
      optimized_block_id: 101,
      department: "ENGINEERING",
      action: "ACCEPT",
      comment: "All good",
      adjustment_category: null,
      adjustment_payload: null,
      performed_by: "engg.demo",
      timestamp: "2026-09-01T04:00:00Z",
    });
  });

  it("renders negotiation history correctly with badges and payload", async () => {
    vi.spyOn(reactOidcContext, "useAuth").mockReturnValue({
      isAuthenticated: true,
      user: {
        profile: {
          sub: "user-1",
          preferred_username: "viewer.demo",
          realm_access: { roles: ["VIEWER"] },
        },
      },
    } as any);

    render(
      <OptimizedBlockDetailDrawer
        block={mockBlock}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("Multi-Department Negotiation")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/P-Way team accepts 4h window/i)).toBeInTheDocument();
      expect(screen.getByText(/Shift required for isolator maintenance/i)).toBeInTheDocument();
      expect(screen.getByText("Shift start to 02:30 UTC")).toBeInTheDocument();
    });
  });

  it("shows negotiation action form for authorized negotiator (ENGINEERING)", async () => {
    vi.spyOn(reactOidcContext, "useAuth").mockReturnValue({
      isAuthenticated: true,
      user: {
        profile: {
          sub: "engg-1",
          preferred_username: "engg.demo",
          realm_access: { roles: ["ENGINEERING"] },
        },
      },
    } as any);

    render(
      <OptimizedBlockDetailDrawer
        block={mockBlock}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("Submit Negotiation Action")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Accept$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Adjust$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Reject$/i })).toBeInTheDocument();
  });

  it("toggles structured adjustment fields when ADJUST action is clicked", async () => {
    vi.spyOn(reactOidcContext, "useAuth").mockReturnValue({
      isAuthenticated: true,
      user: {
        profile: {
          sub: "trd-1",
          preferred_username: "trd.demo",
          realm_access: { roles: ["TRD"] },
        },
      },
    } as any);

    render(
      <OptimizedBlockDetailDrawer
        block={mockBlock}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const adjustBtn = screen.getByRole("button", { name: /Adjust/i });
    fireEvent.click(adjustBtn);

    expect(screen.getByText("Structured Parameter Adjustment")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/e\.g\., Shift start window to 03:00 UTC/i)
    ).toBeInTheDocument();
  });

  it("disables negotiation action form on finalized blocks", async () => {
    vi.spyOn(reactOidcContext, "useAuth").mockReturnValue({
      isAuthenticated: true,
      user: {
        profile: {
          sub: "engg-1",
          preferred_username: "engg.demo",
          realm_access: { roles: ["ENGINEERING"] },
        },
      },
    } as any);

    render(
      <OptimizedBlockDetailDrawer
        block={mockFinalizedBlock}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/This block is finalized \(APPROVED\)/i)).toBeInTheDocument();
    expect(screen.queryByText("Submit Negotiation Action")).not.toBeInTheDocument();
  });
});
