"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  History,
  Send,
  SlidersHorizontal,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import * as possessionApi from "@/lib/api/possession";
import type {
  PossessionOutcome,
  PossessionOutcomeStatus,
  PossessionOutcomeCreateRequest,
} from "@/lib/types/possession";
import type { OptimizedBlock } from "@/lib/types/optimization";

interface PossessionOutcomePanelProps {
  block: OptimizedBlock;
  isAuthorized?: boolean;
}

const statusBadgeColors: Record<string, string> = {
  PLANNED:
    "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  IN_PROGRESS:
    "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  COMPLETED:
    "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  CANCELLED:
    "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
  DELAYED:
    "bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800",
};

export function PossessionOutcomePanel({
  block,
  isAuthorized = false,
}: PossessionOutcomePanelProps) {
  const [outcomes, setOutcomes] = useState<PossessionOutcome[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Form states
  const [formStatus, setFormStatus] =
    useState<PossessionOutcomeStatus>("COMPLETED");
  const [delayMinutes, setDelayMinutes] = useState<string>("0");
  const [cancellationReason, setCancellationReason] = useState<string>("");
  const [actualImpactScore, setActualImpactScore] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const fetchOutcomes = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await possessionApi.getBlockPossessionOutcomes(block.id);
      setOutcomes(data || []);
    } catch {
      // Gracefully handle not found or load error
      setOutcomes([]);
    } finally {
      setIsLoading(false);
    }
  }, [block.id]);

  useEffect(() => {
    fetchOutcomes();
  }, [fetchOutcomes]);

  const handleCreateOutcome = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const delayVal = parseInt(delayMinutes, 10);
    const impactVal = actualImpactScore ? parseFloat(actualImpactScore) : null;

    const payload: PossessionOutcomeCreateRequest = {
      planned_start: block.block_start,
      planned_end: block.block_end,
      actual_start: block.block_start,
      actual_end: block.block_end,
      status: formStatus,
      delay_minutes: isNaN(delayVal) ? null : delayVal,
      cancellation_reason:
        formStatus === "CANCELLED" ? cancellationReason.trim() : null,
      affected_departments: block.departments_involved,
      planned_impact_score: block.estimated_impact_score,
      actual_impact_score: isNaN(impactVal as number) ? null : impactVal,
      notes: notes.trim() || null,
    };

    try {
      setIsSubmitting(true);
      await possessionApi.createPossessionOutcome(block.id, payload);
      setShowRecordForm(false);
      await fetchOutcomes();
    } catch (err: any) {
      setSubmitError(
        err?.message || "Failed to record possession outcome ledger entry.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const latestOutcome = outcomes.length > 0 ? outcomes[0] : null;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-3.5 sm:p-4 shadow-2xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-blue-600" />
          <span className="text-xs font-bold text-foreground">
            Possession Outcome Ledger
          </span>
        </div>

        <span className="text-[10px] uppercase font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded">
          Badge 4 Governance
        </span>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Post-execution accountability record tracking planned vs actual
        intervals, delays, cancellations, affected departments, and impact
        metrics.
      </p>

      {isLoading ? (
        <div className="rounded border border-border bg-muted/20 p-3 text-[11px] text-muted-foreground text-center">
          Loading outcome ledger...
        </div>
      ) : latestOutcome ? (
        <div className="space-y-3">
          {/* Outcome Summary Card */}
          <div className="rounded border border-border bg-background p-3 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground">
                Execution Status
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold border ${
                  statusBadgeColors[latestOutcome.status] ||
                  statusBadgeColors.PLANNED
                }`}
              >
                {latestOutcome.status}
              </span>
            </div>

            {/* Planned vs Actual Interval Comparison */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2 rounded bg-muted/30 border border-border space-y-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Planned Window
                </span>
                <span className="text-[11px] text-foreground block">
                  {formatDateTime(latestOutcome.planned_start)}
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  → {formatDateTime(latestOutcome.planned_end)}
                </span>
              </div>

              <div className="p-2 rounded bg-muted/30 border border-border space-y-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Actual Window
                </span>
                <span className="text-[11px] text-foreground block">
                  {latestOutcome.actual_start
                    ? formatDateTime(latestOutcome.actual_start)
                    : "Not recorded"}
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  →{" "}
                  {latestOutcome.actual_end
                    ? formatDateTime(latestOutcome.actual_end)
                    : "Not recorded"}
                </span>
              </div>
            </div>

            {/* Delay and Impact Metrics */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded bg-muted/20 border border-border space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Operational Delay
                </span>
                <span
                  className={`font-semibold ${
                    (latestOutcome.delay_minutes || 0) > 0
                      ? "text-amber-600"
                      : "text-foreground"
                  }`}
                >
                  {latestOutcome.delay_minutes !== null &&
                  latestOutcome.delay_minutes !== undefined
                    ? `${latestOutcome.delay_minutes} minutes`
                    : "None"}
                </span>
              </div>

              <div className="p-2 rounded bg-muted/20 border border-border space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Planned vs Actual Impact
                </span>
                <span className="font-semibold text-foreground">
                  {latestOutcome.planned_impact_score?.toFixed(2) ?? "0.00"} →{" "}
                  {latestOutcome.actual_impact_score?.toFixed(2) ?? "N/A"}
                </span>
              </div>
            </div>

            {/* Cancellation Reason */}
            {latestOutcome.cancellation_reason && (
              <div className="rounded border border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/20 p-2.5 space-y-1">
                <div className="flex items-center gap-1.5 text-red-800 dark:text-red-300 font-semibold text-xs">
                  <XCircle className="h-3.5 w-3.5" />
                  <span>Cancellation Reason</span>
                </div>
                <p className="text-[11px] text-red-700 dark:text-red-400">
                  {latestOutcome.cancellation_reason}
                </p>
              </div>
            )}

            {/* Affected Departments */}
            {latestOutcome.affected_departments &&
              latestOutcome.affected_departments.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                    Affected Departments
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {latestOutcome.affected_departments.map((d) => (
                      <span
                        key={d}
                        className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}

            {/* Notes */}
            {latestOutcome.notes && (
              <p className="text-[11px] text-muted-foreground italic pl-1 border-l-2 border-border">
                &ldquo;{latestOutcome.notes}&rdquo;
              </p>
            )}

            <div className="text-[10px] text-muted-foreground text-right">
              Recorded by{" "}
              <span className="font-semibold text-foreground">
                {latestOutcome.recorded_by || "System"}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="rounded border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground">
            No execution outcome recorded yet for this possession block.
          </div>

          {isAuthorized && !showRecordForm && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRecordForm(true)}
              className="w-full text-xs font-semibold"
            >
              + Record Execution Outcome
            </Button>
          )}
        </div>
      )}

      {/* Record Outcome Form (Modal/Inline) */}
      {showRecordForm && (
        <form
          onSubmit={handleCreateOutcome}
          className="rounded border border-border bg-muted/20 p-3 space-y-3 text-xs animate-in fade-in"
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-foreground">
              Log Possession Execution
            </span>
            <button
              type="button"
              onClick={() => setShowRecordForm(false)}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              Cancel
            </button>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Outcome Status
            </label>
            <select
              value={formStatus}
              onChange={(e) =>
                setFormStatus(e.target.value as PossessionOutcomeStatus)
              }
              className="w-full rounded border border-border bg-background p-1.5 text-xs text-foreground"
            >
              <option value="COMPLETED">Completed</option>
              <option value="DELAYED">Delayed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="PLANNED">Planned</option>
            </select>
          </div>

          {formStatus === "DELAYED" && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Delay (Minutes)
              </label>
              <input
                type="number"
                min="0"
                value={delayMinutes}
                onChange={(e) => setDelayMinutes(e.target.value)}
                className="w-full rounded border border-border bg-background p-1.5 text-xs text-foreground"
              />
            </div>
          )}

          {formStatus === "CANCELLED" && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Cancellation Reason <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Reason for cancellation..."
                className="w-full rounded border border-border bg-background p-1.5 text-xs text-foreground"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Actual Impact Score
            </label>
            <input
              type="number"
              step="0.01"
              value={actualImpactScore}
              onChange={(e) => setActualImpactScore(e.target.value)}
              placeholder="e.g. 0.85"
              className="w-full rounded border border-border bg-background p-1.5 text-xs text-foreground"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Governance Remarks / Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Operational log notes..."
              className="w-full rounded border border-border bg-background p-2 text-xs text-foreground resize-none"
            />
          </div>

          {submitError && (
            <div className="p-2 rounded bg-red-50 dark:bg-red-950/50 text-red-800 dark:text-red-300 text-xs flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <Button
            type="submit"
            disabled={isSubmitting}
            size="sm"
            className="w-full h-8 text-xs font-semibold"
          >
            {isSubmitting ? "Recording..." : "Save Outcome Record"}
          </Button>
        </form>
      )}
    </div>
  );
}
