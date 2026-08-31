"use client";

import React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { IntegrationOpportunity } from "@/lib/types/maintenance";
import { formatDuration, formatScore } from "@/lib/utils";
import { ArrowUpRight, Layers, Sparkles } from "lucide-react";

interface IntegrationOpportunitiesSummaryProps {
  opportunities?: IntegrationOpportunity[];
  totalOpportunities?: number;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
}

export function IntegrationOpportunitiesSummary({
  opportunities = [],
  totalOpportunities = 0,
  isLoading,
  isError,
  errorMessage,
  onRetry,
}: IntegrationOpportunitiesSummaryProps) {
  if (isLoading) {
    return (
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold">Cross-Department Integration Opportunities</CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingState message="Scanning cross-department task combinations..." rows={4} />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold">Cross-Department Integration Opportunities</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorState
            title="Failed to load integration opportunities"
            message={errorMessage || "Unable to retrieve cross-department combinations."}
            onRetry={onRetry}
          />
        </CardContent>
      </Card>
    );
  }

  if (opportunities.length === 0) {
    return (
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold">Cross-Department Integration Opportunities</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No integration opportunities"
            description="No multi-task combinations identified across sections."
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
            <Layers className="h-4 w-4 text-emerald-600" />
            <span>Cross-Department Integration Opportunities</span>
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            Screened multi-task combinations co-located in identical corridor sections.
          </CardDescription>
        </div>
        <Link
          href="/planning"
          className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 shrink-0"
        >
          <span>Explore All ({totalOpportunities})</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-[140px] text-xs font-bold">Opportunity ID</TableHead>
                <TableHead className="text-xs font-bold">Section</TableHead>
                <TableHead className="text-xs font-bold">Departments Involved</TableHead>
                <TableHead className="text-xs font-bold text-center">Tasks</TableHead>
                <TableHead className="text-xs font-bold text-right">Combined Time</TableHead>
                <TableHead className="text-xs font-bold text-right">Compatibility</TableHead>
                <TableHead className="text-xs font-bold text-right">Total Priority</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {opportunities.map((opp) => {
                const taskCount = opp.task_ids?.length || 0;
                const depts = opp.departments_involved || [];
                const isTriDept = depts.length >= 3;

                return (
                  <TableRow key={opp.opportunity_id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-mono text-xs font-semibold text-foreground">
                      {opp.opportunity_id}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {opp.section_id}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 items-center">
                        {depts.map((dept) => (
                          <span
                            key={dept}
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold border ${
                              dept === "Engineering"
                                ? "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                                : dept === "S&T"
                                ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                : "bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                            }`}
                          >
                            {dept}
                          </span>
                        ))}
                        {isTriDept && (
                          <span className="rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-1 py-0.2 text-[9px] font-bold">
                            3-WAY
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-xs">
                      <span className="inline-block rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 font-bold text-slate-800 dark:text-slate-200 text-[11px]">
                        {taskCount}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {formatDuration(opp.combined_duration_hrs)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {opp.compatibility_score}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-extrabold text-foreground">
                      {formatScore(opp.priority_summary?.total_priority_value)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="p-3 bg-muted/20 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-600" />
            <span>
              <strong>Advisory:</strong> Integration opportunities are candidate screening inputs for the CP-SAT optimizer, not confirmed operational possessions.
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
