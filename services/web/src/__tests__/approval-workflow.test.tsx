import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApprovalWorkflowPanel } from "@/components/optimization/approval-workflow-panel";
import { ApprovalAuditHistory } from "@/components/optimization/approval-audit-history";
import * as optimizationApi from "@/lib/api/optimization";
import { OptimizationRun } from "@/lib/types/optimization";

const mockDraftRun: OptimizationRun = {
  id: 1,
  run_id: "RUN-0001",
  run_type: "standard",
  planning_horizon_start: "2026-08-31T00:00:00Z",
  planning_horizon_end: "2026-09-06T23:59:59Z",
  status: "Completed",
  solver_status: "OPTIMAL",
  approval_status: "DRAFT",
  objective_value: 3840.5,
  solve_time_seconds: 4.12,
  tasks_considered: 53,
  tasks_scheduled: 23,
  tasks_unassigned: 30,
  integrated_block_count: 5,
  separate_block_count: 7,
  estimated_total_block_hours: 48.5,
  unassigned_task_ids: [],
  warnings: [],
  notes: null,
  created_at: "2026-08-31T18:00:00Z",
};

const mockSubmittedRun: OptimizationRun = {
  ...mockDraftRun,
  approval_status: "SUBMITTED",
  submitted_by: "planner_hwh",
  submitted_at: "2026-08-31T19:00:00Z",
};

const mockApprovedRun: OptimizationRun = {
  ...mockDraftRun,
  approval_status: "APPROVED",
  submitted_by: "planner_hwh",
  submitted_at: "2026-08-31T19:00:00Z",
  approved_by: "approver_drm",
  approved_at: "2026-08-31T19:30:00Z",
};

const mockRejectedRun: OptimizationRun = {
  ...mockDraftRun,
  approval_status: "REJECTED",
  submitted_by: "planner_hwh",
  submitted_at: "2026-08-31T19:00:00Z",
  rejected_by: "approver_drm",
  rejected_at: "2026-08-31T19:45:00Z",
  rejection_reason: "Heavy traffic window conflict at Dankuni.",
};

const mockAuditLogs = [
  {
    id: 1,
    timestamp: "2026-08-31T19:00:00Z",
    user_id: "planner_hwh",
    action: "SUBMITTED",
    entity_type: "OptimizationRun",
    entity_id: "1",
    before_value: '{"approval_status": "DRAFT"}',
    after_value: '{"approval_status": "SUBMITTED"}',
    details: "Optimization plan submitted for human operational review.",
    ip_address: null,
  },
  {
    id: 2,
    timestamp: "2026-08-31T19:30:00Z",
    user_id: "approver_drm",
    action: "APPROVED",
    entity_type: "OptimizationRun",
    entity_id: "1",
    before_value: '{"approval_status": "SUBMITTED"}',
    after_value: '{"approval_status": "APPROVED"}',
    details: "Optimization plan officially approved by operational authority.",
    ip_address: null,
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

describe("Human Approval Workflow & Audit Trail (Batch 7J)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Solver Status and Approval Status separately", () => {
    render(
      <ApprovalWorkflowPanel
        run={mockDraftRun}
        user={{ id: "1", username: "planner_hwh", name: "Planner User", roles: ["PLANNER"] }}
        onStateChange={vi.fn()}
      />
    );

    expect(screen.getByText("Solver:")).toBeInTheDocument();
    expect(screen.getByText("OPTIMAL")).toBeInTheDocument();
    expect(screen.getByText("Approval: DRAFT")).toBeInTheDocument();
  });

  it("allows Planner to submit DRAFT run for approval", async () => {
    const onStateChange = vi.fn();
    const submitSpy = vi.spyOn(optimizationApi, "submitOptimizationRun").mockResolvedValue({
      ...mockDraftRun,
      approval_status: "SUBMITTED",
    });

    render(
      <ApprovalWorkflowPanel
        run={mockDraftRun}
        user={{ id: "1", username: "planner_hwh", name: "Planner User", roles: ["PLANNER"] }}
        onStateChange={onStateChange}
      />
    );

    const submitBtn = screen.getByRole("button", { name: /Submit for Approval/i });
    expect(submitBtn).toBeInTheDocument();

    fireEvent.click(submitBtn);

    // Confirmation dialog appears
    expect(screen.getByText("Submit Optimization Plan for Review")).toBeInTheDocument();
    const confirmBtn = screen.getByRole("button", { name: /Confirm & Submit/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(submitSpy).toHaveBeenCalledWith(1);
      expect(onStateChange).toHaveBeenCalled();
    });
  });

  it("hides write actions for VIEWER role", () => {
    render(
      <ApprovalWorkflowPanel
        run={mockDraftRun}
        user={{ id: "2", username: "viewer_guest", name: "Viewer Guest", roles: ["VIEWER"] }}
        onStateChange={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: /Submit for Approval/i })).not.toBeInTheDocument();
    expect(screen.getByText(/\(Planner role required to submit\)/i)).toBeInTheDocument();
  });

  it("allows Approver to approve SUBMITTED plan", async () => {
    const onStateChange = vi.fn();
    const approveSpy = vi.spyOn(optimizationApi, "approveOptimizationRun").mockResolvedValue({
      ...mockSubmittedRun,
      approval_status: "APPROVED",
    });

    render(
      <ApprovalWorkflowPanel
        run={mockSubmittedRun}
        user={{ id: "3", username: "approver_drm", name: "Approver User", roles: ["APPROVER"] }}
        onStateChange={onStateChange}
      />
    );

    const approveBtn = screen.getByRole("button", { name: /Approve Plan/i });
    const rejectBtn = screen.getByRole("button", { name: /Reject Plan/i });
    expect(approveBtn).toBeInTheDocument();
    expect(rejectBtn).toBeInTheDocument();

    fireEvent.click(approveBtn);

    expect(screen.getByText("Approve Corridor Maintenance Plan")).toBeInTheDocument();
    const confirmApproveBtn = screen.getByRole("button", { name: /Confirm Official Approval/i });
    fireEvent.click(confirmApproveBtn);

    await waitFor(() => {
      expect(approveSpy).toHaveBeenCalledWith(1);
      expect(onStateChange).toHaveBeenCalled();
    });
  });

  it("requires rejection reason of at least 5 characters", async () => {
    const onStateChange = vi.fn();
    const rejectSpy = vi.spyOn(optimizationApi, "rejectOptimizationRun").mockResolvedValue({
      ...mockSubmittedRun,
      approval_status: "REJECTED",
    });

    render(
      <ApprovalWorkflowPanel
        run={mockSubmittedRun}
        user={{ id: "3", username: "approver_drm", name: "Approver User", roles: ["APPROVER"] }}
        onStateChange={onStateChange}
      />
    );

    const rejectBtn = screen.getByRole("button", { name: /Reject Plan/i });
    fireEvent.click(rejectBtn);

    expect(screen.getByText("Reject Optimization Plan")).toBeInTheDocument();
    const confirmRejectBtn = screen.getByRole("button", { name: /Confirm Rejection/i });
    expect(confirmRejectBtn).toBeDisabled();

    const textarea = screen.getByPlaceholderText(/Excessive passenger train conflicts/i);
    fireEvent.change(textarea, { target: { value: "Track possession conflict at Dankuni Junction." } });

    expect(confirmRejectBtn).not.toBeDisabled();
    fireEvent.click(confirmRejectBtn);

    await waitFor(() => {
      expect(rejectSpy).toHaveBeenCalledWith(1, "Track possession conflict at Dankuni Junction.");
      expect(onStateChange).toHaveBeenCalled();
    });
  });

  it("displays approved metadata when APPROVED", () => {
    render(
      <ApprovalWorkflowPanel
        run={mockApprovedRun}
        user={{ id: "3", username: "approver_drm", name: "Approver User", roles: ["APPROVER"] }}
        onStateChange={vi.fn()}
      />
    );

    expect(screen.getByText("Corridor Plan Officially Approved")).toBeInTheDocument();
    expect(screen.getByText(/approver_drm/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Approve Plan/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Submit for Approval/i })).not.toBeInTheDocument();
  });

  it("displays rejection reason and allows resubmission when REJECTED", () => {
    render(
      <ApprovalWorkflowPanel
        run={mockRejectedRun}
        user={{ id: "1", username: "planner_hwh", name: "Planner User", roles: ["PLANNER"] }}
        onStateChange={vi.fn()}
      />
    );

    expect(screen.getByText("Corridor Plan Rejected")).toBeInTheDocument();
    expect(screen.getByText("Heavy traffic window conflict at Dankuni.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Resubmit for Review/i })).toBeInTheDocument();
  });

  it("renders chronological audit history timeline", async () => {
    vi.spyOn(optimizationApi, "getOptimizationRunAuditTrail").mockResolvedValue({
      items: mockAuditLogs as any,
      total: 2,
    });

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ApprovalAuditHistory runId={1} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Approval History & Audit Trail")).toBeInTheDocument();
      expect(screen.getByText("2 Audit Events Recorded")).toBeInTheDocument();
      expect(screen.getByText("SUBMITTED")).toBeInTheDocument();
      expect(screen.getByText("APPROVED")).toBeInTheDocument();
      expect(screen.getByText("planner_hwh")).toBeInTheDocument();
      expect(screen.getByText("approver_drm")).toBeInTheDocument();
    });
  });
});
