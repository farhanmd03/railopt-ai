"use client";

import React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SeverityBadge } from "@/components/status/severity-badge";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { MaintenanceTask } from "@/lib/types/maintenance";
import { formatScore } from "@/lib/utils";
import { ArrowUpRight, Clock, Wrench } from "lucide-react";

interface MaintenanceQueueProps {
  tasks?: MaintenanceTask[];
  totalTasks?: number;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
}

export function MaintenanceQueue({
  tasks = [],
  totalTasks = 0,
  isLoading,
  isError,
  errorMessage,
  onRetry,
}: MaintenanceQueueProps) {
  if (isLoading) {
    return (
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold">Top Maintenance Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingState message="Loading maintenance work orders..." rows={5} />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold">Top Maintenance Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorState
            title="Failed to load maintenance queue"
            message={errorMessage || "Unable to retrieve maintenance tasks from backend."}
            onRetry={onRetry}
          />
        </CardContent>
      </Card>
    );
  }

  if (tasks.length === 0) {
    return (
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold">Top Maintenance Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No maintenance tasks"
            description="No active maintenance work orders registered for this division."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card shadow-xs">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-foreground">
            <Wrench className="h-4 w-4 text-blue-600" />
            <span>High-Priority Maintenance Queue</span>
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            Showing top {tasks.length} of {totalTasks} work orders sorted by priority score descending.
          </CardDescription>
        </div>
        <Link
          href="/maintenance"
          className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 shrink-0"
        >
          <span>View All Tasks</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-[110px] text-xs font-bold">Task ID</TableHead>
                <TableHead className="text-xs font-bold">Department</TableHead>
                <TableHead className="text-xs font-bold">Section</TableHead>
                <TableHead className="text-xs font-bold">Severity</TableHead>
                <TableHead className="text-xs font-bold text-right">Priority Score</TableHead>
                <TableHead className="text-xs font-bold text-right">Overdue</TableHead>
                <TableHead className="text-xs font-bold text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => {
                const isOverdue = (task.days_overdue || 0) > 0;
                return (
                  <TableRow key={task.task_id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-mono text-xs font-bold text-foreground">
                      {task.task_id}
                    </TableCell>
                    <TableCell className="text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {task.department}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {task.section_id || "—"}
                    </TableCell>
                    <TableCell>
                      <SeverityBadge severity={task.severity} />
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-bold text-foreground">
                      {formatScore(task.priority_score)}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {isOverdue ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                          <Clock className="h-3 w-3" />
                          <span>{task.days_overdue}d</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0d</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-block rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {task.status || "Open"}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
