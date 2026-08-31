"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import * as optimizationApi from "@/lib/api/optimization";
import { OptimizationRun, OptimizedBlock } from "@/lib/types/optimization";
import { SolverStatusBadge } from "@/components/status/solver-status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { formatDateTime, formatDuration, formatScore } from "@/lib/utils";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Cpu,
  ExternalLink,
  Layers,
  Sparkles,
  Train,
  Wrench,
  XCircle,
} from "lucide-react";

interface OptimizationResultViewProps {
  run: OptimizationRun;
}

export function OptimizationResultView({ run }: OptimizationResultViewProps) {
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [filterSection, setFilterSection] = useState("");
  const [filterIntegratedOnly, setFilterIntegratedOnly] = useState(false);

  const isInfeasible = run.solver_status === "INFEASIBLE";

  // Fetch scheduled blocks for this run
  const blocksQuery = useQuery({
    queryKey: ["optimization-blocks", run.id],
    queryFn: () => optimizationApi.getOptimizedBlocks(run.id, { page: 1, page_size: 100 }),
    enabled: !isInfeasible,
  });

  const rawBlocks = blocksQuery.data?.items || [];
  const filteredBlocks = rawBlocks.filter((b) => {
    if (filterSection && b.section_id !== filterSection) return false;
    if (filterIntegratedOnly && !b.is_integrated) return false;
    return true;
  });

  const availableSections = Array.from(
    new Set(rawBlocks.map((b) => b.section_id).filter(Boolean))
  ).sort();

  return (
    <div className="bg-card border border-border rounded shadow-xs overflow-hidden space-y-0">
      {/* Top Banner: Run Summary & Status */}
      <div className="p-4 sm:p-5 border-b border-border bg-muted/20 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-extrabold text-foreground bg-background px-2.5 py-0.5 rounded border border-border">
                {run.run_id}
              </span>
              <SolverStatusBadge status={run.solver_status} />
              <span className="text-xs text-muted-foreground bg-background px-2 py-0.5 rounded border border-border">
                Solve Time: <strong className="text-foreground">{run.solve_time_seconds?.toFixed(2) ?? "0.00"}s</strong>
              </span>
            </div>
            <p className="text-xs text-muted-foreground pt-0.5">
              {run.solver_status === "OPTIMAL"
                ? "Solver found the globally optimal schedule within the mathematical model."
                : run.solver_status === "FEASIBLE"
                ? "Solver found a feasible schedule satisfying all hard invariants."
                : run.solver_status === "INFEASIBLE"
                ? "No feasible plan was found under current constraints."
                : "Optimization run completed."}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                Objective Value
              </span>
              <span className="font-mono text-xl font-extrabold text-blue-600">
                {formatScore(run.objective_value)}
              </span>
            </div>
            <Link href={`/optimization/runs/${run.id}`}>
              <Button size="sm" className="h-8 gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white">
                <Clock className="h-3.5 w-3.5" />
                <span>Planning Timeline</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Aggregate KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2.5 text-xs pt-1">
          <div className="p-2.5 rounded bg-background border border-border shadow-2xs">
            <div className="text-[10px] text-muted-foreground font-semibold">Tasks Scheduled</div>
            <div className="text-base font-extrabold text-emerald-600 mt-0.5">
              {run.tasks_scheduled}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                / {run.tasks_considered}
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded bg-background border border-border shadow-2xs">
            <div className="text-[10px] text-muted-foreground font-semibold">Tasks Unassigned</div>
            <div className="text-base font-extrabold text-amber-600 mt-0.5">
              {run.tasks_unassigned}
            </div>
          </div>

          <div className="p-2.5 rounded bg-background border border-border shadow-2xs">
            <div className="text-[10px] text-muted-foreground font-semibold">Integrated Blocks</div>
            <div className="text-base font-extrabold text-purple-600 mt-0.5">
              {run.integrated_block_count}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                ({run.separate_block_count} single)
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded bg-background border border-border shadow-2xs">
            <div className="text-[10px] text-muted-foreground font-semibold">Est. Block Hours</div>
            <div className="text-base font-extrabold text-foreground mt-0.5">
              {formatDuration(run.estimated_total_block_hours)}
            </div>
          </div>

          <div className="p-2.5 rounded bg-background border border-border shadow-2xs col-span-2 sm:col-span-1">
            <div className="text-[10px] text-muted-foreground font-semibold">Planning Horizon</div>
            <div className="text-xs font-mono font-bold text-foreground mt-0.5 truncate">
              {run.planning_horizon_start?.slice(0, 10) || "—"} →{" "}
              {run.planning_horizon_end?.slice(0, 10) || "—"}
            </div>
          </div>
        </div>
      </div>

      {/* INFEASIBLE State Handling */}
      {isInfeasible ? (
        <div className="p-6 text-center space-y-3">
          <div className="inline-flex p-3 rounded-full bg-red-100 dark:bg-red-950 text-red-600">
            <XCircle className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-foreground">
            No Feasible Schedule Found
          </h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            The CP-SAT solver determined that no combination of candidate windows can satisfy all active hard constraints (e.g. required task duration or timetable exclusivity) within the selected horizon.
          </p>
          <div className="text-xs text-blue-600 font-semibold pt-1">
            Suggestion: Extend the planning horizon or review task maintenance requirements.
          </div>
        </div>
      ) : (
        <div className="p-4 sm:p-5 space-y-4">
          {/* Blocks Table Filter & Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-blue-600 shrink-0" />
              <div>
                <span className="text-xs font-bold text-foreground block">
                  Recommended Maintenance Possession Blocks
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Algorithmic CP-SAT solution recommendations scheduled for this run.
                </span>
              </div>
            </div>

            {/* Table Filters */}
            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              {availableSections.length > 0 && (
                <select
                  value={filterSection}
                  onChange={(e) => setFilterSection(e.target.value)}
                  aria-label="Filter blocks by section"
                  className="h-7 rounded border border-input bg-background px-2 text-xs text-foreground focus:outline-none"
                >
                  <option value="">All Sections ({rawBlocks.length})</option>
                  {availableSections.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                </select>
              )}

              <label className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground select-none">
                <input
                  type="checkbox"
                  checked={filterIntegratedOnly}
                  onChange={(e) => setFilterIntegratedOnly(e.target.checked)}
                  className="rounded border-input text-purple-600 focus:ring-ring h-3.5 w-3.5"
                />
                <span>Integrated only</span>
              </label>
            </div>
          </div>

          {/* Blocks Table Content */}
          {blocksQuery.isLoading ? (
            <LoadingState message="Loading scheduled blocks..." rows={4} />
          ) : blocksQuery.isError ? (
            <ErrorState
              title="Failed to load scheduled blocks"
              message="Unable to retrieve block details for this run."
              onRetry={() => blocksQuery.refetch()}
            />
          ) : filteredBlocks.length === 0 ? (
            <EmptyState
              title="No blocks match filter criteria"
              description="Clear filters to view all recommended blocks."
              icon={<Train className="h-6 w-6" />}
            />
          ) : (
            <div className="overflow-x-auto rounded border border-border">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="w-[150px] text-xs font-bold">Optimized Block</TableHead>
                    <TableHead className="text-xs font-bold">Section</TableHead>
                    <TableHead className="text-xs font-bold">Scheduled Window</TableHead>
                    <TableHead className="text-xs font-bold text-right">Duration</TableHead>
                    <TableHead className="text-xs font-bold">Tasks</TableHead>
                    <TableHead className="text-xs font-bold">Departments</TableHead>
                    <TableHead className="text-xs font-bold text-right" title="Realized Priority value for CP-SAT objective">
                      Realized Priority
                    </TableHead>
                    <TableHead className="text-xs font-bold text-center">Resource</TableHead>
                    <TableHead className="text-xs font-bold text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBlocks.map((block) => {
                    const depts = block.departments_involved || [];
                    const resourceStatus = block.resource_status || "UNVERIFIED";

                    return (
                      <TableRow key={block.id} className="hover:bg-muted/30">
                        <TableCell className="font-mono text-xs font-bold text-foreground">
                          {block.optimized_block_id}
                          {block.is_integrated && (
                            <span className="ml-1.5 rounded bg-purple-50 dark:bg-purple-950 px-1.5 py-0.2 text-[9px] font-bold text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                              Integrated
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {block.section_id}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          <span>{formatDateTime(block.block_start)}</span>
                          <span className="mx-1 text-muted-foreground/60">→</span>
                          <span>{formatDateTime(block.block_end)}</span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold text-foreground">
                          {formatDuration(block.block_duration_hrs)}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          <span className="font-semibold text-foreground">{block.task_ids.length}</span>{" "}
                          ({block.task_ids.join(", ")})
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 items-center">
                            {depts.map((d) => (
                              <span
                                key={d}
                                className={`rounded px-1.5 py-0.2 text-[10px] font-semibold border ${
                                  d === "Engineering"
                                    ? "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                                    : d === "S&T"
                                    ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                    : "bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                                }`}
                              >
                                {d}
                              </span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-extrabold text-foreground">
                          {formatScore(block.realized_priority_value)}
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={`inline-block rounded px-1.5 py-0.2 text-[10px] font-semibold border ${
                              resourceStatus === "VERIFIED"
                                ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                : "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                            }`}
                          >
                            {resourceStatus}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-block rounded-full bg-blue-50 dark:bg-blue-950 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            {block.status || "Candidate"}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Unassigned Tasks Summary Accordion */}
          {run.unassigned_task_ids && run.unassigned_task_ids.length > 0 && (
            <div className="bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded p-3 space-y-2">
              <div
                onClick={() => setShowUnassigned(!showUnassigned)}
                className="flex items-center justify-between cursor-pointer select-none"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    Unassigned Tasks ({run.unassigned_task_ids.length})
                  </span>
                </div>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-amber-800">
                  {showUnassigned ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>

              {showUnassigned && (
                <div className="pt-2 border-t border-amber-200 dark:border-amber-800 space-y-1.5 text-xs">
                  <p className="text-muted-foreground text-[11px]">
                    These work orders could not be scheduled within candidate corridor windows without violating safety/timetable invariants:
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {run.unassigned_task_ids.map((taskId) => (
                      <Link
                        key={taskId}
                        href={`/maintenance`}
                        className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold bg-background px-2 py-0.5 rounded border border-border hover:border-primary text-foreground"
                      >
                        <Wrench className="h-3 w-3 text-blue-600" />
                        <span>{taskId}</span>
                        <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
