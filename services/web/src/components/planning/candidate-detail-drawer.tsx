"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { CandidateBlock } from "@/lib/types/candidate-block";
import { FeasibilityBadge } from "@/components/status/feasibility-badge";
import { formatDateTime, formatDuration, formatScore } from "@/lib/utils";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Layers,
  MapPin,
  Package,
  ShieldAlert,
  Train,
  Wrench,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface CandidateDetailDrawerProps {
  candidate: CandidateBlock | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CandidateDetailDrawer({
  candidate,
  isOpen,
  onClose,
}: CandidateDetailDrawerProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !candidate) return null;

  const status =
    candidate.computed_feasibility_status || candidate.feasibility_status || "FEASIBLE";
  const duration = candidate.required_duration_hrs || candidate.block_duration_hrs;
  const windowDuration = candidate.window_duration_hrs;
  const hasConflict =
    status === "TRAIN_CONFLICT" ||
    Boolean(candidate.train_conflict) ||
    (candidate.train_conflict_count || 0) > 0;
  const conflictCount =
    candidate.train_conflict_count ?? (candidate.train_conflicts ?? (candidate.train_conflict ? 1 : 0));
  const resourceStatus = candidate.resource_check || "UNVERIFIED";
  const freightInfo = candidate.freight_level ? candidate.freight_level : "Not available";
  const depts = candidate.departments_involved || [];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div
        className="relative z-10 w-full max-w-xl bg-card border-l border-border shadow-2xl h-full flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="candidate-detail-title"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border flex items-start justify-between bg-muted/30">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-extrabold text-foreground bg-background px-2.5 py-0.5 rounded border border-border">
                {candidate.candidate_id}
              </span>
              <FeasibilityBadge status={status} />
              <span
                className={`inline-block rounded px-2 py-0.5 text-[11px] font-semibold border ${
                  resourceStatus === "VERIFIED"
                    ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                    : "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                }`}
              >
                Resource: {resourceStatus}
              </span>
            </div>
            <h2 id="candidate-detail-title" className="text-base font-bold text-foreground pt-1">
              Candidate Corridor Possession Option
            </h2>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close candidate details"
            className="h-8 w-8 p-0 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* Key Attributes Grid */}
          <div className="bg-muted/20 border border-border rounded p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                Railway Section
              </span>
              <span className="font-mono font-semibold text-foreground mt-0.5 block">
                {candidate.section_id}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                Corridor Window
              </span>
              <span className="font-mono font-semibold text-foreground mt-0.5 block">
                {candidate.window_id}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                Required Duration
              </span>
              <span className="font-mono font-semibold text-foreground mt-0.5 block">
                {formatDuration(duration)}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                Candidate Priority
              </span>
              <span className="font-mono font-extrabold text-foreground mt-0.5 block">
                {formatScore(candidate.priority_score)}
              </span>
            </div>
          </div>

          {/* Time Window Interval */}
          <div className="p-3.5 rounded border border-border bg-card space-y-2">
            <span className="text-xs font-bold text-foreground block">
              Possession Window Timeline
            </span>
            <div className="flex items-center justify-between text-xs font-mono bg-muted/40 p-2.5 rounded border border-border">
              <div>
                <span className="text-[10px] text-muted-foreground block uppercase">Window Start</span>
                <span className="font-bold text-foreground">{formatDateTime(candidate.candidate_start)}</span>
              </div>
              <span className="text-muted-foreground">→</span>
              <div className="text-right">
                <span className="text-[10px] text-muted-foreground block uppercase">Window End</span>
                <span className="font-bold text-foreground">{formatDateTime(candidate.candidate_end)}</span>
              </div>
            </div>
            {windowDuration && (
              <div className="text-[11px] text-muted-foreground flex justify-between">
                <span>Total Available Window Duration:</span>
                <strong className="text-foreground">{formatDuration(windowDuration)}</strong>
              </div>
            )}
          </div>

          {/* Operational Constraints: Train Conflicts, Freight, Resources */}
          <div className="space-y-2.5">
            <span className="text-xs font-bold text-foreground block">
              Operational Constraints Evaluation
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              {/* Train Conflict Card */}
              <div
                className={`p-3 rounded border ${
                  hasConflict
                    ? "bg-red-50/50 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-red-900 dark:text-red-300"
                    : "bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-300"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  {hasConflict ? (
                    <ShieldAlert className="h-4 w-4 text-red-600" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  )}
                  <span>Train Conflicts</span>
                </div>
                <div className="text-lg font-extrabold mt-1">
                  {hasConflict ? `${conflictCount} Conflict(s)` : "Zero Conflicts"}
                </div>
                <p className="text-[10px] opacity-80 mt-0.5">
                  {hasConflict
                    ? "Overlaps with scheduled train path"
                    : "Clear timetable slot available"}
                </p>
              </div>

              {/* Freight Impact Card */}
              <div className="p-3 rounded border border-border bg-muted/20">
                <div className="flex items-center gap-1.5 font-bold text-foreground">
                  <Package className="h-4 w-4 text-blue-600" />
                  <span>Freight Impact</span>
                </div>
                <div className="text-lg font-extrabold text-foreground mt-1">
                  {freightInfo}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Section freight path density
                </p>
              </div>

              {/* Resource Verification Card */}
              <div className="p-3 rounded border border-border bg-muted/20">
                <div className="flex items-center gap-1.5 font-bold text-foreground">
                  <Wrench className="h-4 w-4 text-purple-600" />
                  <span>Resource Status</span>
                </div>
                <div className="text-lg font-extrabold text-foreground mt-1">
                  {resourceStatus}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Machine & crew readiness
                </p>
              </div>
            </div>
          </div>

          {/* Tasks Included with Direct Maintenance Links */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground block">
                Work Orders Included ({candidate.task_ids.length})
              </span>
              <span className="text-[11px] text-muted-foreground">
                Click task to view in workbench
              </span>
            </div>

            <div className="space-y-1.5">
              {candidate.task_ids.map((taskId) => (
                <Link
                  key={taskId}
                  href={`/maintenance`}
                  className="p-2.5 rounded border border-border bg-background hover:bg-muted/40 transition-colors flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2">
                    <Wrench className="h-3.5 w-3.5 text-blue-600" />
                    <span className="font-mono text-xs font-bold text-foreground group-hover:text-primary">
                      {taskId}
                    </span>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
                </Link>
              ))}
            </div>
          </div>

          {/* Candidate Engine Rationale / Reasons */}
          {candidate.reasons && candidate.reasons.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                Candidate Generation & Screening Rationale
              </span>
              <ul className="space-y-1 bg-muted/20 p-3 rounded border border-border">
                {candidate.reasons.map((reason, idx) => (
                  <li key={idx} className="text-xs text-foreground flex items-start gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Mandatory Candidate Screening Advisory */}
          <div className="p-3 rounded border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/30 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Computational Candidate Option</span>
              <span className="text-[11px]">
                This is a combinatorial candidate block option generated for the OR-Tools CP-SAT integer optimization engine. It is NOT an authorized track possession.
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-muted/40 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <span>Howrah Division • Decision Support</span>
          <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
