"use client";

import React, { use, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "react-oidc-context";
import { buildAuthUser } from "@/lib/auth-config";
import * as optimizationApi from "@/lib/api/optimization";
import { OptimizationRun, OptimizedBlock } from "@/lib/types/optimization";

import { SolverStatusBadge } from "@/components/status/solver-status-badge";
import { PlanningTimeline } from "@/components/optimization/planning-timeline";
import { OptimizedBlockDetailDrawer } from "@/components/optimization/optimized-block-detail-drawer";
import { NetworkMapPlaceholder } from "@/components/optimization/network-map-placeholder";
import { OptimizationHistory } from "@/components/optimization/optimization-history";
import { ApprovalWorkflowPanel } from "@/components/optimization/approval-workflow-panel";
import { ApprovalAuditHistory } from "@/components/optimization/approval-audit-history";
import { ExplainButton } from "@/components/explainability/explain-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { formatDateTime, formatDuration, formatScore } from "@/lib/utils";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Cpu,
  ExternalLink,
  Layers,
  RefreshCw,
  Sliders,
  Sparkles,
  Train,
  TramFront,
  User as UserIcon,
  Wrench,
  XCircle,
} from "lucide-react";

interface OptimizationRunPageProps {
  params?: Promise<{ run_id: string }> | { run_id: string };
}

export default function OptimizationRunPage({ params }: OptimizationRunPageProps) {
  const navParams = useParams();
  const router = useRouter();

  // Robust run_id resolution
  const runIdParam =
    (navParams?.run_id as string) ||
    (params && "then" in (params as Promise<{ run_id: string }>)
      ? use(params as Promise<{ run_id: string }>).run_id
      : (params as { run_id: string })?.run_id) ||
    "1";

  const auth = useAuth();
  const user = buildAuthUser(auth.user);

  const [selectedBlock, setSelectedBlock] = useState<OptimizedBlock | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [filterSection, setFilterSection] = useState("");
  const [filterIntegratedOnly, setFilterIntegratedOnly] = useState(false);

  // 1. Fetch Run Metadata
  const runQuery = useQuery({
    queryKey: ["optimization-run", runIdParam],
    queryFn: () => optimizationApi.getOptimizationRun(runIdParam),
  });

  const run = runQuery.data;
  const isInfeasible = run?.solver_status === "INFEASIBLE";
  const isUnknown = run?.solver_status === "UNKNOWN" || run?.solver_status === "NOT_SOLVED";

  // 2. Fetch Scheduled Blocks for this Run
  const blocksQuery = useQuery({
    queryKey: ["optimization-blocks", run?.id || runIdParam],
    queryFn: () =>
      optimizationApi.getOptimizedBlocks(run?.id || runIdParam, {
        page: 1,
        page_size: 100,
      }),
    enabled: !!run && !isInfeasible && !isUnknown,
  });

  // 3. Fetch Historical Runs
  const historyQuery = useQuery({
    queryKey: ["optimization-runs"],
    queryFn: () => optimizationApi.getOptimizationRuns({ page: 1, page_size: 10 }),
  });

  const rawBlocks = blocksQuery.data?.items || run?.scheduled_blocks || [];
  const filteredBlocks = useMemo(() => {
    return rawBlocks.filter((b) => {
      if (filterSection && b.section_id !== filterSection) return false;
      if (filterIntegratedOnly && !b.is_integrated) return false;
      return true;
    });
  }, [rawBlocks, filterSection, filterIntegratedOnly]);

  const availableSections = useMemo(() => {
    const set = new Set<string>();
    rawBlocks.forEach((b) => {
      if (b.section_id) set.add(b.section_id);
    });
    return Array.from(set).sort();
  }, [rawBlocks]);

  const handleSelectBlock = (block: OptimizedBlock) => {
    setSelectedBlock(block);
    setIsDrawerOpen(true);
  };

  const handleRefresh = async () => {
    await Promise.all([runQuery.refetch(), blocksQuery.refetch(), historyQuery.refetch()]);
  };

  if (runQuery.isLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto p-6">
        <LoadingState message="Loading optimization run results..." rows={8} />
      </div>
    );
  }

  if (runQuery.isError || !run) {
    return (
      <div className="space-y-4 max-w-7xl mx-auto p-6">
        <ErrorState
          title="Optimization Run Not Found"
          message={`Unable to retrieve optimization run '${runIdParam}'. Check the Run ID or inspect the optimization runs history.`}
          onRetry={() => runQuery.refetch()}
        />
        <div className="flex justify-center">
          <Link href="/optimization">
            <Button size="sm" className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Return to Optimization Planner</span>
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-900 text-white dark:bg-slate-800 px-2.5 py-1 rounded text-xs font-bold tracking-wider">
              <TramFront className="h-3.5 w-3.5 text-blue-400" />
              <span>HOWRAH DIVISION (HWH)</span>
            </div>
            <span className="rounded px-2 py-0.5 uppercase tracking-wider text-[11px] font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900">
              Eastern Railway
            </span>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded border border-border">
              <Cpu className="h-3 w-3 text-blue-600" />
              <span>OR-Tools CP-SAT Results Workspace</span>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Optimization Plan: <span className="font-mono">{run.run_id}</span>
            </h1>
            <SolverStatusBadge status={run.solver_status} />
          </div>
          <p className="text-xs text-muted-foreground">
            {run.solver_status === "OPTIMAL"
              ? "Globally optimal mathematical schedule recommendation. Requires human operational review and approval."
              : run.solver_status === "FEASIBLE"
              ? "Feasible schedule candidate satisfying all active invariants. Requires human operational review and approval."
              : run.solver_status === "INFEASIBLE"
              ? "No feasible plan was found under the current constraints."
              : "Optimization result status."}
          </p>
        </div>

        {/* User Identity & Navigation Actions */}
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded text-xs text-muted-foreground">
            <UserIcon className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold text-foreground">
              {user?.name || user?.username || "Authorized User"}
            </span>
            <div className="flex gap-1">
              {user?.roles.map((r) => (
                <span
                  key={r}
                  className="rounded bg-blue-50 dark:bg-blue-950 px-1.5 py-0.2 text-[10px] font-bold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                >
                  {r}
                </span>
              ))}
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={runQuery.isFetching || blocksQuery.isFetching}
            className="h-8 gap-1.5 text-xs bg-card hover:bg-muted"
            title="Refresh run results"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${
                runQuery.isFetching || blocksQuery.isFetching ? "animate-spin text-primary" : ""
              }`}
            />
            <span>{runQuery.isFetching || blocksQuery.isFetching ? "Updating..." : "Refresh"}</span>
          </Button>

          <ExplainButton
            request={{
              explanation_type: "RUN_SUMMARY",
              run_id: run.id,
            }}
            label="Explain Result"
            className="h-8"
          />

          <Link href={`/optimization/runs/${encodeURIComponent(runIdParam)}/what-if`}>
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs bg-card hover:bg-muted text-blue-700 border-blue-200">
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
              <span>What-If Scenario</span>
            </Button>
          </Link>

          <Link href="/optimization">
            <Button size="sm" className="h-8 gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white">
              <Sliders className="h-3.5 w-3.5" />
              <span>Optimization Planner</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. Run Summary Banner & Metrics */}
      <div className="bg-card border border-border rounded p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
              Planning Horizon Window
            </span>
            <div className="font-mono text-xs font-bold text-foreground flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-blue-600" />
              <span>{run.planning_horizon_start?.slice(0, 10) || "—"}</span>
              <span className="text-muted-foreground">→</span>
              <span>{run.planning_horizon_end?.slice(0, 10) || "—"}</span>
            </div>
          </div>

          <div className="flex items-center gap-6 text-right">
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                Solve Time
              </span>
              <span className="font-mono text-sm font-bold text-foreground">
                {run.solve_time_seconds?.toFixed(2) ?? "0.00"}s
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                Objective Value
              </span>
              <span className="font-mono text-xl font-extrabold text-blue-600">
                {formatScore(run.objective_value)}
              </span>
            </div>
          </div>
        </div>

        {/* Aggregate KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
          <div className="p-3 rounded bg-muted/20 border border-border">
            <span className="text-[10px] text-muted-foreground font-semibold block">
              Tasks Scheduled
            </span>
            <div className="text-lg font-extrabold text-emerald-600 mt-0.5">
              {run.tasks_scheduled}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                / {run.tasks_considered}
              </span>
            </div>
          </div>

          <div className="p-3 rounded bg-muted/20 border border-border">
            <span className="text-[10px] text-muted-foreground font-semibold block">
              Tasks Unassigned
            </span>
            <div className="text-lg font-extrabold text-amber-600 mt-0.5">
              {run.tasks_unassigned}
            </div>
          </div>

          <div className="p-3 rounded bg-muted/20 border border-border">
            <span className="text-[10px] text-muted-foreground font-semibold block">
              Integrated Blocks
            </span>
            <div className="text-lg font-extrabold text-purple-600 mt-0.5">
              {run.integrated_block_count}
            </div>
          </div>

          <div className="p-3 rounded bg-muted/20 border border-border">
            <span className="text-[10px] text-muted-foreground font-semibold block">
              Separate Single Blocks
            </span>
            <div className="text-lg font-extrabold text-blue-600 mt-0.5">
              {run.separate_block_count}
            </div>
          </div>

          <div className="p-3 rounded bg-muted/20 border border-border col-span-2 sm:col-span-1">
            <span className="text-[10px] text-muted-foreground font-semibold block">
              Est. Block Hours
            </span>
            <div className="text-lg font-extrabold text-foreground mt-0.5">
              {formatDuration(run.estimated_total_block_hours)}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Human Approval Workflow & Audit Trail */}
      <ApprovalWorkflowPanel
        run={run}
        user={user}
        onStateChange={handleRefresh}
      />

      <ApprovalAuditHistory runId={run.id} />

      {/* 4. Infeasible or Unknown Result Handling */}
      {isInfeasible ? (
        <div className="bg-card border border-border rounded p-8 text-center space-y-4 shadow-xs">
          <div className="inline-flex p-3 rounded-full bg-red-100 dark:bg-red-950 text-red-600">
            <XCircle className="h-8 w-8" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-bold text-foreground">
              No Feasible Plan Found
            </h3>
            <p className="text-xs text-muted-foreground">
              The OR-Tools CP-SAT solver determined that no combination of candidate possession windows satisfies all mandatory hard constraints (e.g. required maintenance duration or timetable exclusivity) within this planning horizon.
            </p>
          </div>

          <div className="flex justify-center gap-3 pt-2">
            <Link href="/optimization">
              <Button size="sm" className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white">
                <Sliders className="h-3.5 w-3.5" />
                <span>Adjust Horizon in Planner</span>
              </Button>
            </Link>
            <Link href="/planning">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Layers className="h-3.5 w-3.5" />
                <span>Inspect Candidate Windows</span>
              </Button>
            </Link>
          </div>
        </div>
      ) : isUnknown ? (
        <div className="bg-card border border-border rounded p-8 text-center space-y-3 shadow-xs">
          <AlertCircle className="h-8 w-8 text-amber-600 mx-auto" />
          <h3 className="text-sm font-bold text-foreground">No Validated Result Available</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            The optimization run concluded with status '{run.solver_status}'. No validated mathematical solution is available.
          </p>
        </div>
      ) : (
        <>
          {/* 4. Planning Timeline Gantt Visualization */}
          <PlanningTimeline
            blocks={rawBlocks}
            horizonStart={run.planning_horizon_start}
            horizonEnd={run.planning_horizon_end}
            selectedBlockId={selectedBlock?.optimized_block_id || null}
            onSelectBlock={handleSelectBlock}
          />

          {/* 5. Recommended Blocks Table */}
          <div className="bg-card border border-border rounded shadow-xs overflow-hidden space-y-0">
            <div className="p-3.5 border-b border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-blue-600 shrink-0" />
                <div>
                  <span className="text-xs font-bold text-foreground block">
                    Optimized Possession Blocks ({filteredBlocks.length})
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Recommended maintenance possession windows scheduled by CP-SAT solver.
                  </span>
                </div>
              </div>

              {/* Filters */}
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

            {filteredBlocks.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="No blocks match filter criteria"
                  description="Clear section or integrated filter to view all scheduled blocks."
                  icon={<Train className="h-6 w-6" />}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="w-[150px] text-xs font-bold">Optimized Block</TableHead>
                      <TableHead className="text-xs font-bold">Section</TableHead>
                      <TableHead className="text-xs font-bold">Scheduled Interval</TableHead>
                      <TableHead className="text-xs font-bold text-right">Duration</TableHead>
                      <TableHead className="text-xs font-bold">Tasks</TableHead>
                      <TableHead className="text-xs font-bold">Departments</TableHead>
                      <TableHead className="text-xs font-bold text-right" title="Realized Priority value for CP-SAT objective">
                        Realized Priority
                      </TableHead>
                      <TableHead className="text-xs font-bold text-center">Resource</TableHead>
                      <TableHead className="text-xs font-bold text-center">Status</TableHead>
                      <TableHead className="w-[60px] text-xs font-bold text-center">Inspect</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBlocks.map((block) => {
                      const depts = block.departments_involved || [];
                      const resourceStatus = block.resource_status || "UNVERIFIED";
                      const isSelected = selectedBlock?.optimized_block_id === block.optimized_block_id;

                      return (
                        <TableRow
                          key={block.id}
                          onClick={() => handleSelectBlock(block)}
                          tabIndex={0}
                          role="button"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleSelectBlock(block);
                            }
                          }}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-blue-50/80 dark:bg-blue-950/40 border-l-2 border-l-blue-600"
                              : "hover:bg-muted/30"
                          }`}
                        >
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
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectBlock(block);
                              }}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                              title="Inspect block details"
                            >
                              <Wrench className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* 6. Unassigned Tasks Accordion */}
          {run.unassigned_task_ids && run.unassigned_task_ids.length > 0 && (
            <div className="bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded p-3.5 space-y-2">
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
                <div className="pt-2 border-t border-amber-200 dark:border-amber-800 space-y-2 text-xs">
                  <p className="text-muted-foreground text-[11px]">
                    Task was not assigned under the current optimization constraints (e.g. required duration exceeded window capacity or timetable collision):
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {run.unassigned_task_ids.map((taskId) => (
                      <div
                        key={taskId}
                        className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold bg-background px-2.5 py-1 rounded border border-border text-foreground"
                      >
                        <Wrench className="h-3.5 w-3.5 text-blue-600" />
                        <span>{taskId}</span>
                        <ExplainButton
                          request={{
                            explanation_type: "UNASSIGNED_TASK",
                            run_id: run.id,
                            task_id: taskId,
                          }}
                          label="Why unassigned?"
                          variant="ghost"
                          className="h-5 px-1.5 text-[10px] ml-1"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 7. Railway Network View Placeholder (PostGIS GIS Integration Point) */}
          <NetworkMapPlaceholder
            sectionCount={availableSections.length}
            blockCount={rawBlocks.length}
            runId={run.id}
          />
        </>
      )}

      {/* 8. Historical Runs Explorer for Switching */}
      <OptimizationHistory
        runs={historyQuery.data?.items || []}
        selectedRunId={run.id}
        onSelectRun={(r) => router.push(`/optimization/runs/${r.id}`)}
        isLoading={historyQuery.isLoading && !historyQuery.data}
        isError={historyQuery.isError}
        onRetry={() => historyQuery.refetch()}
      />

      {/* 9. Slide-Over Block Detail Drawer */}
      <OptimizedBlockDetailDrawer
        block={selectedBlock}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </div>
  );
}
