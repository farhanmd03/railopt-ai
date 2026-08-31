"use client";

import React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FeasibilityBadge } from "@/components/status/feasibility-badge";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { CandidateBlock } from "@/lib/types/candidate-block";
import { formatDateTime, formatDuration, formatScore } from "@/lib/utils";
import { ArrowUpRight, Calendar, CheckCircle2 } from "lucide-react";

interface CandidateBlocksSummaryProps {
  candidateBlocks?: CandidateBlock[];
  totalCandidates?: number;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
}

export function CandidateBlocksSummary({
  candidateBlocks = [],
  totalCandidates = 0,
  isLoading,
  isError,
  errorMessage,
  onRetry,
}: CandidateBlocksSummaryProps) {
  if (isLoading) {
    return (
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold">Candidate Maintenance Blocks</CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingState message="Evaluating corridor windows and train paths..." rows={4} />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold">Candidate Maintenance Blocks</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorState
            title="Failed to load candidate blocks"
            message={errorMessage || "Unable to retrieve candidate possession blocks."}
            onRetry={onRetry}
          />
        </CardContent>
      </Card>
    );
  }

  if (candidateBlocks.length === 0) {
    return (
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold">Candidate Maintenance Blocks</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No candidate blocks generated"
            description="No candidate possession blocks evaluated for current window intervals."
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
            <Calendar className="h-4 w-4 text-purple-600" />
            <span>Candidate Maintenance Blocks</span>
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            Window-aligned possession candidates screened against timetable train occupancy and freight volume.
          </CardDescription>
        </div>
        <Link
          href="/planning"
          className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 shrink-0"
        >
          <span>View All ({totalCandidates})</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-[140px] text-xs font-bold">Candidate ID</TableHead>
                <TableHead className="text-xs font-bold">Section</TableHead>
                <TableHead className="text-xs font-bold">Corridor Window</TableHead>
                <TableHead className="text-xs font-bold">Start Time</TableHead>
                <TableHead className="text-xs font-bold text-right">Req Duration</TableHead>
                <TableHead className="text-xs font-bold">Feasibility Status</TableHead>
                <TableHead className="text-xs font-bold text-right">Priority Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidateBlocks.map((c) => {
                const status =
                  c.computed_feasibility_status || c.feasibility_status || "FEASIBLE";
                const duration = c.required_duration_hrs || c.block_duration_hrs;

                return (
                  <TableRow key={c.candidate_id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-mono text-xs font-semibold text-foreground">
                      {c.candidate_id}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {c.section_id}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-medium text-slate-700 dark:text-slate-300">
                      {c.window_id}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(c.candidate_start)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-foreground">
                      {formatDuration(duration)}
                    </TableCell>
                    <TableCell>
                      <FeasibilityBadge status={status} />
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-bold text-foreground">
                      {formatScore(c.priority_score)}
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
              Candidate blocks are combinatorial options fed into the OR-Tools CP-SAT solver.
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
