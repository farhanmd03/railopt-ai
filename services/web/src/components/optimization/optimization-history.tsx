"use client";

import React from "react";
import { OptimizationRun } from "@/lib/types/optimization";
import { SolverStatusBadge } from "@/components/status/solver-status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { formatDateTime, formatScore } from "@/lib/utils";
import { Clock, Cpu, Eye, History } from "lucide-react";

interface OptimizationHistoryProps {
  runs: OptimizationRun[];
  selectedRunId: number | null;
  onSelectRun: (run: OptimizationRun) => void;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

export function OptimizationHistory({
  runs,
  selectedRunId,
  onSelectRun,
  isLoading,
  isError,
  onRetry,
}: OptimizationHistoryProps) {
  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded p-6 shadow-xs">
        <LoadingState message="Loading historical optimization runs..." rows={4} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-card border border-border rounded p-6 shadow-xs">
        <ErrorState
          title="Failed to load historical runs"
          message="Unable to retrieve optimization run history from backend."
          onRetry={onRetry}
        />
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="bg-card border border-border rounded p-6 shadow-xs">
        <EmptyState
          title="No optimization runs recorded"
          description="Configure planning horizon and click 'Generate Optimal Plan' to initiate a CP-SAT solve."
          icon={<History className="h-6 w-6" />}
        />
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded shadow-xs overflow-hidden">
      <div className="p-3.5 border-b border-border bg-muted/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-blue-600" />
          <span className="text-xs font-bold text-foreground">
            Historical Optimization Runs ({runs.length})
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground">
          Select any run to review full recommendations
        </span>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="w-[140px] text-xs font-bold">Run ID</TableHead>
              <TableHead className="text-xs font-bold">Created At</TableHead>
              <TableHead className="text-xs font-bold">Planning Horizon</TableHead>
              <TableHead className="text-xs font-bold text-center">Solver Status</TableHead>
              <TableHead className="text-xs font-bold text-center">Tasks</TableHead>
              <TableHead className="text-xs font-bold text-center">Blocks</TableHead>
              <TableHead className="text-xs font-bold text-right">Objective</TableHead>
              <TableHead className="w-[80px] text-xs font-bold text-center">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run) => {
              const isSelected = selectedRunId === run.id;

              return (
                <TableRow
                  key={run.id}
                  onClick={() => onSelectRun(run)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-blue-50/80 dark:bg-blue-950/40 border-l-2 border-l-blue-600"
                      : "hover:bg-muted/30"
                  }`}
                >
                  <TableCell className="font-mono text-xs font-bold text-foreground">
                    {run.run_id}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDateTime(run.created_at)}
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                    {run.planning_horizon_start?.slice(0, 10) || "—"} →{" "}
                    {run.planning_horizon_end?.slice(0, 10) || "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <SolverStatusBadge status={run.solver_status} />
                  </TableCell>
                  <TableCell className="text-center text-xs font-semibold text-foreground">
                    {run.tasks_scheduled} / {run.tasks_considered}
                  </TableCell>
                  <TableCell className="text-center text-xs font-semibold text-foreground">
                    {run.integrated_block_count + run.separate_block_count}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs font-extrabold text-blue-600">
                    {formatScore(run.objective_value)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectRun(run);
                      }}
                      className="h-7 text-xs gap-1 text-blue-600 hover:text-blue-700"
                    >
                      <Eye className="h-3 w-3" />
                      <span>{isSelected ? "Active" : "Inspect"}</span>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
