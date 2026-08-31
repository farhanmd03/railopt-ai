"use client";

import React, { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getTaskPriority, getTaskIntegrationOpportunities } from "@/lib/api/maintenance";
import { MaintenanceTask } from "@/lib/types/maintenance";
import { SeverityBadge } from "@/components/status/severity-badge";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { formatDateTime, formatDate, formatDuration, formatScore } from "@/lib/utils";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
  Layers,
  MapPin,
  Shield,
  Sparkles,
  Train,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface TaskDetailDrawerProps {
  task: MaintenanceTask | null;
  isOpen: boolean;
  onClose: () => void;
}

export function TaskDetailDrawer({ task, isOpen, onClose }: TaskDetailDrawerProps) {
  // Close drawer on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const taskId = task?.task_id;

  // 1. Fetch deterministic priority assessment on demand
  const priorityQuery = useQuery({
    queryKey: ["task-priority", taskId],
    queryFn: () => getTaskPriority(taskId!),
    enabled: isOpen && !!taskId,
  });

  // 2. Fetch potential integration opportunities for this task on demand
  const opportunitiesQuery = useQuery({
    queryKey: ["task-integration-opportunities", taskId],
    queryFn: () => getTaskIntegrationOpportunities(taskId!),
    enabled: isOpen && !!taskId,
  });

  if (!isOpen || !task) return null;

  const priorityData = priorityQuery.data;
  const opportunities = opportunitiesQuery.data || [];
  const isOverdue = (task.days_overdue || 0) > 0;

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
        className="relative z-10 w-full max-w-2xl bg-card border-l border-border shadow-2xl h-full flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-detail-title"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border flex items-start justify-between bg-muted/30">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-extrabold text-foreground bg-background px-2.5 py-0.5 rounded border border-border">
                {task.task_id}
              </span>
              <SeverityBadge severity={task.severity} />
              <span
                className={`rounded px-2 py-0.5 text-[11px] font-semibold border ${
                  task.department === "Engineering"
                    ? "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                    : task.department === "S&T"
                    ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                    : "bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                }`}
              >
                {task.department}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {task.status || "Open"}
              </span>
            </div>
            <h2 id="task-detail-title" className="text-base font-bold text-foreground pt-1">
              {task.defect_type || "Maintenance Work Order"}
            </h2>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close task details"
            className="h-8 w-8 p-0 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
          {/* Work Order Key Attributes */}
          <div className="bg-muted/20 border border-border rounded p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                Section ID
              </span>
              <span className="font-mono font-semibold text-foreground mt-0.5 block">
                {task.section_id || "—"}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                Asset ID
              </span>
              <span className="font-mono font-semibold text-foreground mt-0.5 block">
                {task.asset_id || "—"}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                Required Duration
              </span>
              <span className="font-mono font-semibold text-foreground mt-0.5 block">
                {formatDuration(task.required_duration_hrs)}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                Days Overdue
              </span>
              <span
                className={`font-semibold mt-0.5 block ${
                  isOverdue ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                }`}
              >
                {task.days_overdue ?? 0} days
              </span>
            </div>
          </div>

          {/* ═════════════════════════════════════════════════════════════════════ */}
          {/* SECTION 1: PRIORITY ASSESSMENT (BASELINE VS COMPUTED)               */}
          {/* ═════════════════════════════════════════════════════════════════════ */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-blue-600" />
                <h3 className="text-sm font-bold text-foreground">Priority Assessment Breakdown</h3>
              </div>
            </div>

            {/* Baseline vs Computed Distinction Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Baseline Card */}
              <div className="p-3.5 rounded border border-border bg-card shadow-2xs space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Baseline Priority
                </span>
                <div className="text-2xl font-extrabold text-foreground font-mono">
                  {formatScore(task.priority_score)}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Static imported source value registered in dataset.
                </p>
              </div>

              {/* Computed Planning Priority Card */}
              <div className="p-3.5 rounded border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30 shadow-2xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider block">
                    Computed Planning Priority
                  </span>
                  {priorityData?.priority_band && (
                    <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-blue-600 text-white">
                      {priorityData.priority_band}
                    </span>
                  )}
                </div>
                {priorityQuery.isLoading ? (
                  <div className="h-8 w-20 bg-blue-200/50 dark:bg-blue-900/50 animate-pulse rounded my-1" />
                ) : priorityQuery.isError ? (
                  <div className="text-xs text-red-600 font-semibold">Assessment unavailable</div>
                ) : (
                  <div className="text-2xl font-extrabold text-blue-900 dark:text-blue-200 font-mono">
                    {formatScore(priorityData?.computed_priority_score)}
                  </div>
                )}
                <p className="text-[11px] text-blue-800 dark:text-blue-300">
                  Deterministic four-factor planning score evaluated by Priority Engine.
                </p>
              </div>
            </div>

            {/* 4-Factor Components & Reasons (Loaded dynamically) */}
            {priorityQuery.isLoading && (
              <LoadingState message="Evaluating four-factor priority scoring..." rows={3} />
            )}

            {priorityData && (
              <div className="bg-muted/30 border border-border rounded p-3.5 space-y-3">
                <span className="text-xs font-bold text-foreground block">
                  Four-Factor Component Weights
                </span>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded bg-background border border-border">
                    <div className="text-[10px] text-muted-foreground font-semibold">1. Severity Component</div>
                    <div className="font-mono font-bold text-foreground mt-0.5">
                      {formatScore(priorityData.components.severity_component)}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-background border border-border">
                    <div className="text-[10px] text-muted-foreground font-semibold">2. Overdue Component</div>
                    <div className="font-mono font-bold text-foreground mt-0.5">
                      {formatScore(priorityData.components.overdue_component)}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-background border border-border">
                    <div className="text-[10px] text-muted-foreground font-semibold">3. Asset Criticality</div>
                    <div className="font-mono font-bold text-foreground mt-0.5">
                      {formatScore(priorityData.components.criticality_component)}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-background border border-border">
                    <div className="text-[10px] text-muted-foreground font-semibold">4. Asset Failure Risk</div>
                    <div className="font-mono font-bold text-foreground mt-0.5">
                      {formatScore(priorityData.components.failure_risk_component)}
                    </div>
                  </div>
                </div>

                {/* Reasons List */}
                {priorityData.reasons && priorityData.reasons.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Deterministic Engine Rationale
                    </span>
                    <ul className="space-y-1">
                      {priorityData.reasons.map((reason, idx) => (
                        <li key={idx} className="text-xs text-foreground flex items-start gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" />
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="text-[10px] text-muted-foreground italic pt-1 border-t border-border/60">
                  Note: Deterministic rule-based priority synthesis for CP-SAT solver prioritization. Not a predictive black-box ML model.
                </div>
              </div>
            )}
          </div>

          {/* ═════════════════════════════════════════════════════════════════════ */}
          {/* SECTION 2: POTENTIAL INTEGRATION OPPORTUNITIES                       */}
          {/* ═════════════════════════════════════════════════════════════════════ */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <div className="flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-purple-600" />
                <h3 className="text-sm font-bold text-foreground">Potential Integration Opportunities</h3>
              </div>
              <span className="text-xs font-semibold text-muted-foreground">
                {opportunities.length} Available
              </span>
            </div>

            <p className="text-xs text-muted-foreground">
              Candidate multi-task combinations co-located in the same corridor section. Evaluated as inputs for combinatorial optimization.
            </p>

            {opportunitiesQuery.isLoading ? (
              <LoadingState message="Discovering section integration opportunities..." rows={2} />
            ) : opportunitiesQuery.isError ? (
              <ErrorState
                title="Failed to load opportunities"
                message="Unable to retrieve integration combinations for this task."
                onRetry={() => opportunitiesQuery.refetch()}
              />
            ) : opportunities.length === 0 ? (
              <div className="p-4 rounded border border-dashed border-border text-center text-xs text-muted-foreground bg-muted/10">
                No co-located compatible opportunities found for this task in the current section backlog.
              </div>
            ) : (
              <div className="space-y-2.5">
                {opportunities.map((opp) => (
                  <div
                    key={opp.opportunity_id}
                    className="p-3 rounded border border-border bg-card shadow-2xs space-y-2 hover:border-border/80 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-xs font-bold text-foreground block truncate max-w-xs sm:max-w-md">
                          {opp.opportunity_id}
                        </span>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="text-[10px] font-semibold text-muted-foreground">
                            Section: {opp.section_id}
                          </span>
                          <span className="text-[10px] text-muted-foreground">•</span>
                          <span className="text-[10px] font-semibold text-muted-foreground">
                            Tasks: {opp.task_ids.join(", ")}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="rounded bg-purple-50 dark:bg-purple-950 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          {opp.compatibility_score}% Compatible
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-border/60">
                      <div className="flex gap-1 items-center">
                        {opp.departments_involved.map((dept) => (
                          <span
                            key={dept}
                            className="rounded px-1.5 py-0.2 text-[10px] font-semibold border bg-muted text-muted-foreground border-border"
                          >
                            {dept}
                          </span>
                        ))}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Duration: <strong className="text-foreground">{formatDuration(opp.combined_duration_hrs)}</strong>
                      </div>
                    </div>

                    {opp.compatibility_reasons && opp.compatibility_reasons.length > 0 && (
                      <div className="text-[11px] text-muted-foreground bg-muted/30 p-2 rounded border border-border/40">
                        {opp.compatibility_reasons.join(" • ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-muted/40 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <span>Howrah Division • Decision Support System</span>
          <Button variant="outline" size="sm" onClick={onClose} className="h-7 text-xs">
            Close Panel
          </Button>
        </div>
      </div>
    </div>
  );
}
