"use client";

import React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApprovalBadge } from "@/components/status/approval-badge";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { OptimizedBlock } from "@/lib/types/optimization";
import { formatDateTime, formatDuration, formatScore } from "@/lib/utils";
import { ArrowUpRight, CheckCircle2, ShieldAlert, Train } from "lucide-react";

interface RecentOptimizedBlocksProps {
  blocks?: OptimizedBlock[];
  totalBlocks?: number;
  runId?: string | number | null;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
}

export function RecentOptimizedBlocks({
  blocks = [],
  totalBlocks = 0,
  runId,
  isLoading,
  isError,
  errorMessage,
  onRetry,
}: RecentOptimizedBlocksProps) {
  if (isLoading) {
    return (
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold">Selected Optimized Blocks</CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingState message="Loading optimized corridor blocks..." rows={5} />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold">Selected Optimized Blocks</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorState
            title="Failed to load optimized blocks"
            message={errorMessage || "Unable to retrieve optimized possession blocks."}
            onRetry={onRetry}
          />
        </CardContent>
      </Card>
    );
  }

  if (blocks.length === 0) {
    return (
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold">Selected Optimized Blocks</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No optimized blocks available"
            description="Run an optimization pass to generate scheduled corridor possession blocks."
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
            <Train className="h-4 w-4 text-blue-600" />
            <span>Recent Optimized Possession Blocks</span>
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            Realized conflict-free possession blocks selected by OR-Tools CP-SAT integer programming solver.
          </CardDescription>
        </div>
        <Link
          href="/optimization"
          className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 shrink-0"
        >
          <span>View All ({totalBlocks})</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-[160px] text-xs font-bold">Optimized Block ID</TableHead>
                <TableHead className="text-xs font-bold">Section</TableHead>
                <TableHead className="text-xs font-bold">Block Window (Start – End)</TableHead>
                <TableHead className="text-xs font-bold text-right">Duration</TableHead>
                <TableHead className="text-xs font-bold">Departments</TableHead>
                <TableHead className="text-xs font-bold text-center">Structure</TableHead>
                <TableHead className="text-xs font-bold text-right" title="Authentic realized task-set priority sum">
                  Realized Priority
                </TableHead>
                <TableHead className="text-xs font-bold text-center">Conflicts</TableHead>
                <TableHead className="text-xs font-bold text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {blocks.map((b) => {
                const depts = b.departments_involved || [];
                const isIntegrated = b.is_integrated;

                return (
                  <TableRow key={b.id || b.optimized_block_id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-mono text-xs font-semibold text-foreground">
                      {b.optimized_block_id}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {b.section_id}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      <span>{formatDateTime(b.block_start)}</span>
                      <span className="mx-1 text-muted-foreground/60">→</span>
                      <span>{formatDateTime(b.block_end)}</span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold text-foreground">
                      {formatDuration(b.block_duration_hrs)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 items-center">
                        {depts.map((d) => (
                          <span
                            key={d}
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold border ${
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
                    <TableCell className="text-center">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold border ${
                          isIntegrated
                            ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        {isIntegrated ? "Integrated" : "Single"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-extrabold text-foreground">
                      {formatScore(b.realized_priority_value)}
                      {b.candidate_priority_value != null &&
                        b.candidate_priority_value !== b.realized_priority_value && (
                          <div className="text-[9px] text-muted-foreground font-normal" title="Screening candidate priority">
                            (cand: {formatScore(b.candidate_priority_value)})
                          </div>
                        )}
                    </TableCell>
                    <TableCell className="text-center">
                      {b.train_conflicts > 0 ? (
                        <span className="inline-flex items-center gap-0.5 text-xs font-bold text-red-600">
                          <ShieldAlert className="h-3 w-3" />
                          <span>{b.train_conflicts}</span>
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-emerald-600">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <ApprovalBadge status={b.status} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="p-3 bg-muted/20 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
            <span>
              <strong>Realized Priority Value:</strong> Sum of actual prioritized tasks assigned to this possession block by CP-SAT.
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
