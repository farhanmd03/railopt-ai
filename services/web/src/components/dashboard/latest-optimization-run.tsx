"use client";

import React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SolverStatusBadge } from "@/components/status/solver-status-badge";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { OptimizationRun } from "@/lib/types/optimization";
import { formatDateTime, formatDuration, formatScore } from "@/lib/utils";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Cpu,
  Layers,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";

interface LatestOptimizationRunProps {
  latestRun?: OptimizationRun | null;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
}

export function LatestOptimizationRun({
  latestRun,
  isLoading,
  isError,
  errorMessage,
  onRetry,
}: LatestOptimizationRunProps) {
  if (isLoading) {
    return (
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold">Latest Optimization Run</CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingState message="Loading latest CP-SAT optimization plan..." rows={4} />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold">Latest Optimization Run</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorState
            title="Failed to load optimization run"
            message={errorMessage || "Unable to retrieve latest optimization results."}
            onRetry={onRetry}
          />
        </CardContent>
      </Card>
    );
  }

  if (!latestRun) {
    return (
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold">Latest Optimization Run</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No optimization plan generated yet."
            description="Run the OR-Tools CP-SAT optimizer to generate mathematically optimal, conflict-free possession blocks."
            action={
              <Link href="/optimization">
                <Button size="sm" className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white">
                  <Cpu className="h-3.5 w-3.5" />
                  <span>Open Optimization</span>
                </Button>
              </Link>
            }
          />
        </CardContent>
      </Card>
    );
  }

  const unassignedCount = latestRun.tasks_unassigned || 0;
  const scheduledCount = latestRun.tasks_scheduled || 0;
  const consideredCount = latestRun.tasks_considered || 0;

  return (
    <Card className="border-border bg-card shadow-xs">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-foreground">
              <Cpu className="h-4 w-4 text-blue-600" />
              <span>Latest Optimization Run</span>
            </CardTitle>
            <span className="font-mono text-xs font-bold text-foreground bg-muted px-2 py-0.5 rounded border border-border">
              {latestRun.run_id}
            </span>
          </div>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            OR-Tools CP-SAT integer optimization result for Howrah Division corridor schedule.
          </CardDescription>
        </div>
        <Link
          href="/optimization"
          className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 shrink-0"
        >
          <span>Optimization Workbench</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Core Metric Highlights */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* 1. Solver Status */}
          <div className="p-2.5 rounded border border-border bg-muted/30">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Solver Status
            </div>
            <div className="mt-1">
              <SolverStatusBadge status={latestRun.solver_status} />
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">
              Solve Time: {latestRun.solve_time_seconds ? `${latestRun.solve_time_seconds.toFixed(2)}s` : "—"}
            </div>
          </div>

          {/* 2. Tasks Scheduled */}
          <div className="p-2.5 rounded border border-border bg-muted/30">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Tasks Scheduled
            </div>
            <div className="text-lg font-extrabold text-foreground mt-0.5">
              {scheduledCount} <span className="text-xs font-normal text-muted-foreground">/ {consideredCount}</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {unassignedCount > 0 ? `${unassignedCount} unassigned tasks` : "All tasks assigned"}
            </div>
          </div>

          {/* 3. Block Structure */}
          <div className="p-2.5 rounded border border-border bg-muted/30">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Integrated vs Separate
            </div>
            <div className="text-lg font-extrabold text-foreground mt-0.5 flex items-baseline gap-1">
              <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">
                {latestRun.integrated_block_count}
              </span>
              <span className="text-xs font-normal text-muted-foreground">int /</span>
              <span className="text-slate-700 dark:text-slate-300 font-extrabold">
                {latestRun.separate_block_count}
              </span>
              <span className="text-xs font-normal text-muted-foreground">sep</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Total: {latestRun.integrated_block_count + latestRun.separate_block_count} blocks
            </div>
          </div>

          {/* 4. Objective & Hours */}
          <div className="p-2.5 rounded border border-border bg-muted/30">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Objective & Duration
            </div>
            <div className="text-lg font-extrabold text-foreground mt-0.5">
              {formatScore(latestRun.objective_value)}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Total Hours: {formatDuration(latestRun.estimated_total_block_hours)}
            </div>
          </div>
        </div>

        {/* Planning Horizon & Notes */}
        <div className="bg-muted/40 p-3 rounded border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-600 shrink-0" />
            <div>
              <span className="font-semibold text-foreground">Planning Horizon: </span>
              <span className="text-muted-foreground">
                {formatDateTime(latestRun.planning_horizon_start)} – {formatDateTime(latestRun.planning_horizon_end)}
              </span>
            </div>
          </div>
          {latestRun.notes && (
            <span className="text-[11px] text-muted-foreground truncate max-w-md">
              {latestRun.notes}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
