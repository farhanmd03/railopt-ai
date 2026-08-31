"use client";

import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { SeverityBadge } from "@/components/status/severity-badge";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { MaintenanceTask } from "@/lib/types/maintenance";
import { formatDuration, formatScore } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Clock, Eye, Wrench } from "lucide-react";

interface MaintenanceTableProps {
  tasks: MaintenanceTask[];
  totalTasks: number;
  page: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  selectedTaskId: string | null;
  onSelectTask: (task: MaintenanceTask) => void;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
}

export function MaintenanceTable({
  tasks,
  totalTasks,
  page,
  pageSize,
  totalPages,
  onPageChange,
  selectedTaskId,
  onSelectTask,
  isLoading,
  isError,
  errorMessage,
  onRetry,
}: MaintenanceTableProps) {
  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded p-6 shadow-xs">
        <LoadingState message="Loading maintenance work orders..." rows={8} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-card border border-border rounded p-6 shadow-xs">
        <ErrorState
          title="Failed to load maintenance tasks"
          message={errorMessage || "Unable to retrieve maintenance tasks from backend."}
          onRetry={onRetry}
        />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="bg-card border border-border rounded p-6 shadow-xs">
        <EmptyState
          title="No maintenance tasks match your filters"
          description="Try clearing or adjusting your filter parameters."
          icon={<Wrench className="h-6 w-6" />}
        />
      </div>
    );
  }

  const startRecord = (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, totalTasks);

  return (
    <div className="bg-card border border-border rounded shadow-xs overflow-hidden">
      {/* Table header bar */}
      <div className="p-3.5 border-b border-border flex items-center justify-between bg-muted/20">
        <div className="text-xs font-semibold text-foreground">
          Showing <span className="font-bold">{startRecord}–{endRecord}</span> of{" "}
          <span className="font-bold">{totalTasks}</span> tasks
        </div>
        <div className="text-[11px] text-muted-foreground hidden sm:block">
          Click any work order to inspect four-factor priority scoring and integration opportunities
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="w-[110px] text-xs font-bold">Task ID</TableHead>
              <TableHead className="text-xs font-bold">Defect Description</TableHead>
              <TableHead className="text-xs font-bold">Department</TableHead>
              <TableHead className="text-xs font-bold">Section</TableHead>
              <TableHead className="text-xs font-bold">Asset ID</TableHead>
              <TableHead className="text-xs font-bold">Severity</TableHead>
              <TableHead className="text-xs font-bold text-right" title="Baseline imported priority score">
                Priority Score
              </TableHead>
              <TableHead className="text-xs font-bold text-right">Overdue</TableHead>
              <TableHead className="text-xs font-bold text-center">Status</TableHead>
              <TableHead className="w-[60px] text-xs font-bold text-center">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => {
              const isSelected = selectedTaskId === task.task_id;
              const isOverdue = (task.days_overdue || 0) > 0;

              return (
                <TableRow
                  key={task.task_id}
                  onClick={() => onSelectTask(task)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectTask(task);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-pressed={isSelected}
                  className={`cursor-pointer transition-colors focus:outline-none focus:bg-muted/50 ${
                    isSelected
                      ? "bg-blue-50/80 dark:bg-blue-950/40 border-l-2 border-l-blue-600"
                      : "hover:bg-muted/30"
                  }`}
                >
                  <TableCell className="font-mono text-xs font-bold text-foreground">
                    {task.task_id}
                  </TableCell>
                  <TableCell className="text-xs font-medium text-foreground max-w-xs truncate">
                    {task.defect_type || "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    <span
                      className={`rounded px-1.5 py-0.2 text-[10px] font-semibold border ${
                        task.department === "Engineering"
                          ? "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                          : task.department === "S&T"
                          ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                          : "bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                      }`}
                    >
                      {task.department}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {task.section_id || "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {task.asset_id || "—"}
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
                  <TableCell className="text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectTask(task);
                      }}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                      title="Inspect task details"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Bar */}
      <div className="p-3.5 bg-muted/20 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="text-muted-foreground">
          Page <span className="font-bold text-foreground">{page}</span> of{" "}
          <span className="font-bold text-foreground">{totalPages || 1}</span>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || isLoading}
            className="h-8 text-xs gap-1"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>Previous</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || isLoading}
            className="h-8 text-xs gap-1"
          >
            <span>Next</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
