"use client";

import React, { useState } from "react";
import { AuthUser } from "@/lib/auth-config";
import { OptimizationRun } from "@/lib/types/optimization";
import { submitOptimizationRun, approveOptimizationRun, rejectOptimizationRun } from "@/lib/api/optimization";
import { formatDateTime } from "@/lib/utils";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  FileCheck2,
  Loader2,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  User as UserIcon,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ApprovalWorkflowPanelProps {
  run: OptimizationRun;
  user: AuthUser | null;
  onStateChange: () => void;
}

export function ApprovalWorkflowPanel({
  run,
  user,
  onStateChange,
}: ApprovalWorkflowPanelProps) {
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const approvalStatus = (run.approval_status || "DRAFT").toUpperCase();
  const solverStatus = run.solver_status || "UNKNOWN";

  const userRoles = user?.roles || [];
  const isPlannerOrAdmin = userRoles.includes("PLANNER") || userRoles.includes("ADMIN");
  const isApproverOrAdmin = userRoles.includes("APPROVER") || userRoles.includes("ADMIN");

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await submitOptimizationRun(run.id);
      setIsSubmitModalOpen(false);
      onStateChange();
    } catch (err: any) {
      if (err?.status === 409 || err?.message?.includes("409")) {
        setErrorMessage("Another user has already changed this optimization run's approval state. Please refresh.");
      } else if (err?.status === 403 || err?.message?.includes("403")) {
        setErrorMessage("Permission denied: You do not have the required role to submit plans for approval.");
      } else {
        setErrorMessage(err?.message || "Failed to submit optimization run for approval.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async () => {
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await approveOptimizationRun(run.id);
      setIsApproveModalOpen(false);
      onStateChange();
    } catch (err: any) {
      if (err?.status === 409 || err?.message?.includes("409")) {
        setErrorMessage("Another user has already changed this optimization run's approval state. Please refresh.");
      } else if (err?.status === 403 || err?.message?.includes("403")) {
        setErrorMessage("Permission denied: Only authorized Approvers or Administrators can approve maintenance plans.");
      } else {
        setErrorMessage(err?.message || "Failed to approve optimization plan.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (rejectionReason.trim().length < 5) {
      setErrorMessage("Please provide a meaningful rejection explanation (minimum 5 characters).");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await rejectOptimizationRun(run.id, rejectionReason.trim());
      setIsRejectModalOpen(false);
      setRejectionReason("");
      onStateChange();
    } catch (err: any) {
      if (err?.status === 409 || err?.message?.includes("409")) {
        setErrorMessage("Another user has already changed this optimization run's approval state. Please refresh.");
      } else if (err?.status === 403 || err?.message?.includes("403")) {
        setErrorMessage("Permission denied: Only authorized Approvers or Administrators can reject maintenance plans.");
      } else {
        setErrorMessage(err?.message || "Failed to reject optimization plan.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded p-4 shadow-xs space-y-3">
      {/* 1. Header with Separation of Solver Status vs Approval Status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">
              Operational Governance & Approval
            </span>
            <span className="text-[11px] text-muted-foreground italic">
              (Human Authority Decision Support)
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Mathematical solver recommendations must be reviewed and officially ratified prior to corridor execution.
          </p>
        </div>

        {/* Dual Status Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Solver Status Badge */}
          <div className="flex items-center gap-1.5 bg-muted/60 border border-border px-2.5 py-1 rounded text-xs">
            <Cpu className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-muted-foreground font-semibold">Solver:</span>
            <span className="font-mono font-extrabold text-foreground">
              {solverStatus}
            </span>
          </div>

          {/* Approval Status Badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold border ${
              approvalStatus === "APPROVED"
                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                : approvalStatus === "SUBMITTED"
                ? "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                : approvalStatus === "REJECTED"
                ? "bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800"
                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"
            }`}
          >
            {approvalStatus === "APPROVED" && <CheckCircle2 className="h-3.5 w-3.5" />}
            {approvalStatus === "SUBMITTED" && <Clock className="h-3.5 w-3.5" />}
            {approvalStatus === "REJECTED" && <XCircle className="h-3.5 w-3.5" />}
            {approvalStatus === "DRAFT" && <FileCheck2 className="h-3.5 w-3.5" />}
            <span>Approval: {approvalStatus}</span>
          </div>
        </div>
      </div>

      {/* 2. Error Message Banner */}
      {errorMessage && (
        <div className="p-2.5 rounded bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-800 dark:text-red-300 flex items-start gap-2 animate-in fade-in">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="flex-1">{errorMessage}</div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setErrorMessage(null)}
            className="h-5 px-1.5 text-[10px] hover:bg-red-100 dark:hover:bg-red-900"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* 3. State Details & Context */}
      <div className="text-xs space-y-2">
        {approvalStatus === "DRAFT" && (
          <div className="p-3 rounded bg-muted/20 border border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-0.5">
              <span className="font-bold text-foreground block">
                Draft Recommendation — Unsubmitted
              </span>
              <span className="text-muted-foreground">
                This solver solution is currently in DRAFT state. A planner may inspect the corridor schedule and submit it for formal review.
              </span>
            </div>

            {isPlannerOrAdmin ? (
              <Button
                size="sm"
                onClick={() => setIsSubmitModalOpen(true)}
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700 text-white shrink-0 gap-1.5 text-xs h-8 shadow-xs"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Submit for Approval</span>
              </Button>
            ) : (
              <span className="text-[11px] text-muted-foreground italic shrink-0">
                (Planner role required to submit)
              </span>
            )}
          </div>
        )}

        {approvalStatus === "SUBMITTED" && (
          <div className="p-3 rounded bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-200 font-bold">
                <Clock className="h-4 w-4 text-amber-600" />
                <span>Under Review by Divisional Authorities</span>
              </div>
              <p className="text-muted-foreground text-[11px]">
                Submitted by <strong className="text-foreground">{run.submitted_by || "Planner"}</strong> on{" "}
                {formatDateTime(run.submitted_at)}. Awaiting ratification by authorized block approver.
              </p>
            </div>

            {isApproverOrAdmin ? (
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  onClick={() => setIsApproveModalOpen(true)}
                  disabled={isSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs h-8 shadow-xs"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Approve Plan</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsRejectModalOpen(true)}
                  disabled={isSubmitting}
                  className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950 gap-1.5 text-xs h-8 shadow-xs"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  <span>Reject Plan</span>
                </Button>
              </div>
            ) : (
              <span className="text-[11px] text-muted-foreground italic shrink-0">
                (Approver role required to take action)
              </span>
            )}
          </div>
        )}

        {approvalStatus === "APPROVED" && (
          <div className="p-3 rounded bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-900 dark:text-emerald-200 font-bold text-sm">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>Corridor Plan Officially Approved</span>
            </div>
            <p className="text-[11px] text-emerald-950/80 dark:text-emerald-200/80">
              Formally approved by <strong className="font-semibold">{run.approved_by || "Authorized Approver"}</strong> on{" "}
              {formatDateTime(run.approved_at)}. Possession blocks are cleared for execution.
            </p>
          </div>
        )}

        {approvalStatus === "REJECTED" && (
          <div className="p-3 rounded bg-red-50/60 dark:bg-red-950/30 border border-red-300 dark:border-red-800 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-red-900 dark:text-red-200 font-bold text-sm">
                <ShieldAlert className="h-4 w-4 text-red-600" />
                <span>Corridor Plan Rejected</span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                Rejected by <strong className="text-foreground">{run.rejected_by || "Approver"}</strong> on{" "}
                {formatDateTime(run.rejected_at)}
              </span>
            </div>

            {run.rejection_reason && (
              <div className="p-2.5 rounded bg-background/80 border border-border text-[11px] space-y-0.5">
                <span className="font-bold text-red-700 dark:text-red-400 uppercase text-[10px] tracking-wider block">
                  Rejection Reason / Required Remediation:
                </span>
                <p className="text-foreground italic">{run.rejection_reason}</p>
              </div>
            )}

            {isPlannerOrAdmin && (
              <div className="pt-1 flex items-center justify-end">
                <Button
                  size="sm"
                  onClick={() => setIsSubmitModalOpen(true)}
                  disabled={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 text-xs h-7 shadow-xs"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Resubmit for Review</span>
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 4. Confirmation Dialogs ──────────────────────────── */}

      {/* Submit Confirmation Dialog */}
      <Dialog open={isSubmitModalOpen} onOpenChange={setIsSubmitModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-bold">
              <Send className="h-4 w-4 text-blue-600" />
              <span>Submit Optimization Plan for Review</span>
            </DialogTitle>
            <DialogDescription className="text-xs space-y-2 pt-2">
              <p>
                This will submit the optimization result for human operational review.
                It does <strong>not</strong> authorize operational execution.
              </p>
              <div className="p-2 rounded bg-muted/40 border border-border font-mono text-[11px]">
                Run ID: {run.run_id} • Solver Status: {solverStatus}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSubmitModalOpen(false)}
              disabled={isSubmitting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5"
            >
              {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              <span>Confirm & Submit</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Confirmation Dialog */}
      <Dialog open={isApproveModalOpen} onOpenChange={setIsApproveModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-bold">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Approve Corridor Maintenance Plan</span>
            </DialogTitle>
            <DialogDescription className="text-xs space-y-2 pt-2">
              <p>
                Are you sure you want to officially approve this plan? Once approved, the scheduled possession blocks will be cleared for divisional execution.
              </p>
              <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-[11px]">
                Your username (<strong className="font-mono">{user?.username}</strong>) will be permanently recorded in the immutable audit trail.
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsApproveModalOpen(false)}
              disabled={isSubmitting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
            >
              {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              <span>Confirm Official Approval</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog with Mandatory Reason */}
      <Dialog open={isRejectModalOpen} onOpenChange={setIsRejectModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-bold text-red-600">
              <XCircle className="h-4 w-4" />
              <span>Reject Optimization Plan</span>
            </DialogTitle>
            <DialogDescription className="text-xs space-y-2 pt-2">
              <p>
                Please provide a mandatory explanation for rejecting this plan. The reason will be recorded in the audit trail and displayed to the planning team.
              </p>
              <div className="space-y-1 pt-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Rejection Reason (min 5 characters) *
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Excessive passenger train conflicts during morning peak hours on Dankuni chord."
                  className="w-full p-2 bg-background border border-input rounded text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRejectModalOpen(false)}
              disabled={isSubmitting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleReject}
              disabled={isSubmitting || rejectionReason.trim().length < 5}
              className="bg-red-600 hover:bg-red-700 text-white text-xs gap-1.5"
            >
              {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
              <span>Confirm Rejection</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
