"use client";

import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FeasibilityBadge } from "@/components/status/feasibility-badge";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { CandidateBlock } from "@/lib/types/candidate-block";
import { formatDateTime, formatDuration, formatScore } from "@/lib/utils";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  RotateCcw,
  Search,
  ShieldAlert,
  Train,
} from "lucide-react";

export interface CandidateFilterState {
  search: string;
  sectionId: string;
  feasibilityStatus: string;
  opportunityId: string;
  date: string;
}

interface CandidateBlockExplorerProps {
  candidates: CandidateBlock[];
  totalCandidates: number;
  page: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  filters: CandidateFilterState;
  onFilterChange: (filters: CandidateFilterState) => void;
  onResetFilters: () => void;
  selectedCandidateId: string | null;
  onSelectCandidate: (candidate: CandidateBlock) => void;
  availableSections?: string[];
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
}

export function CandidateBlockExplorer({
  candidates,
  totalCandidates,
  page,
  pageSize,
  totalPages,
  onPageChange,
  filters,
  onFilterChange,
  onResetFilters,
  selectedCandidateId,
  onSelectCandidate,
  availableSections = [],
  isLoading,
  isError,
  errorMessage,
  onRetry,
}: CandidateBlockExplorerProps) {
  const hasActiveFilters =
    Boolean(filters.search) ||
    Boolean(filters.sectionId) ||
    Boolean(filters.feasibilityStatus) ||
    Boolean(filters.opportunityId) ||
    Boolean(filters.date);

  const startRecord = (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, totalCandidates);

  return (
    <div className="bg-card border border-border rounded shadow-xs overflow-hidden space-y-0">
      {/* Header & Filter Bar */}
      <div className="p-3.5 border-b border-border bg-muted/20 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <Train className="h-4 w-4 text-blue-600 shrink-0" />
            <div>
              <span className="text-xs font-bold text-foreground block">
                Candidate Possession Blocks Explorer
              </span>
              <span className="text-[11px] text-muted-foreground">
                Combinatorial window options evaluated for train conflicts, freight occupancy, and CP-SAT solver inputs.
              </span>
            </div>
          </div>

          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={onResetFilters}
              className="h-7 text-xs gap-1.5 self-start sm:self-auto text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset Filters</span>
            </Button>
          )}
        </div>

        {/* Opportunity Filter Chip if active */}
        {filters.opportunityId && (
          <div className="flex items-center gap-2 text-xs bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 p-2 rounded border border-purple-200 dark:border-purple-800">
            <span>Filtered for Opportunity: <strong className="font-mono">{filters.opportunityId}</strong></span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onFilterChange({ ...filters, opportunityId: "" })}
              className="h-5 px-1.5 text-[11px] text-purple-700 hover:text-purple-900"
            >
              Clear
            </Button>
          </div>
        )}

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
          {/* Search */}
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search Candidate ID, window..."
              value={filters.search}
              onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
              className="h-8 pl-8 text-xs bg-background"
            />
          </div>

          {/* Section Filter */}
          <div>
            {availableSections.length > 0 ? (
              <select
                value={filters.sectionId}
                onChange={(e) => onFilterChange({ ...filters, sectionId: e.target.value })}
                aria-label="Filter candidates by section"
                className="h-8 w-full rounded border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">All Sections</option>
                {availableSections.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                placeholder="Section (e.g. HOW_SEC_001)"
                value={filters.sectionId}
                onChange={(e) => onFilterChange({ ...filters, sectionId: e.target.value })}
                className="h-8 text-xs bg-background"
              />
            )}
          </div>

          {/* Feasibility Status Filter */}
          <div>
            <select
              value={filters.feasibilityStatus}
              onChange={(e) => onFilterChange({ ...filters, feasibilityStatus: e.target.value })}
              aria-label="Filter by feasibility status"
              className="h-8 w-full rounded border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Feasibilities</option>
              <option value="FEASIBLE">Feasible (Conflict-free)</option>
              <option value="TRAIN_CONFLICT">Train Conflict</option>
              <option value="DURATION_INSUFFICIENT">Duration Insufficient</option>
            </select>
          </div>

          {/* Date Filter */}
          <div>
            <Input
              type="date"
              value={filters.date}
              onChange={(e) => onFilterChange({ ...filters, date: e.target.value })}
              className="h-8 text-xs bg-background"
            />
          </div>
        </div>
      </div>

      {/* Main Content / Table */}
      {isLoading ? (
        <div className="p-6">
          <LoadingState message="Evaluating corridor candidate blocks..." rows={6} />
        </div>
      ) : isError ? (
        <div className="p-6">
          <ErrorState
            title="Failed to load candidate blocks"
            message={errorMessage || "Unable to retrieve candidate blocks from backend."}
            onRetry={onRetry}
          />
        </div>
      ) : candidates.length === 0 ? (
        <div className="p-6">
          <EmptyState
            title="No candidate blocks match your filters"
            description="Try adjusting your section, feasibility, or date parameters."
            icon={<Train className="h-6 w-6" />}
          />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-[180px] text-xs font-bold">Candidate ID</TableHead>
                  <TableHead className="text-xs font-bold">Section</TableHead>
                  <TableHead className="text-xs font-bold">Corridor Window</TableHead>
                  <TableHead className="text-xs font-bold">Window Interval</TableHead>
                  <TableHead className="text-xs font-bold text-right">Req Duration</TableHead>
                  <TableHead className="text-xs font-bold text-right" title="Screening candidate priority score">
                    Candidate Priority
                  </TableHead>
                  <TableHead className="text-xs font-bold text-center">Feasibility</TableHead>
                  <TableHead className="text-xs font-bold text-center">Conflicts</TableHead>
                  <TableHead className="text-xs font-bold text-center">Resource</TableHead>
                  <TableHead className="w-[60px] text-xs font-bold text-center">Inspect</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((c) => {
                  const isSelected = selectedCandidateId === c.candidate_id;
                  const status =
                    c.computed_feasibility_status || c.feasibility_status || "FEASIBLE";
                  const duration = c.required_duration_hrs || c.block_duration_hrs;
                  const hasConflict =
                    status === "TRAIN_CONFLICT" ||
                    Boolean(c.train_conflict) ||
                    (c.train_conflict_count || 0) > 0;
                  const conflictCount = c.train_conflict_count ?? (c.train_conflicts ?? (c.train_conflict ? 1 : 0));
                  const resourceStatus = c.resource_check || "UNVERIFIED";

                  return (
                    <TableRow
                      key={c.candidate_id}
                      onClick={() => onSelectCandidate(c)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelectCandidate(c);
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
                        {c.candidate_id}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {c.section_id}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-700 dark:text-slate-300 font-medium">
                        {c.window_id}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        <span>{formatDateTime(c.candidate_start)}</span>
                        <span className="mx-1 text-muted-foreground/60">→</span>
                        <span>{formatDateTime(c.candidate_end)}</span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold text-foreground">
                        {formatDuration(duration)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-extrabold text-foreground">
                        {formatScore(c.priority_score)}
                      </TableCell>
                      <TableCell className="text-center">
                        <FeasibilityBadge status={status} />
                      </TableCell>
                      <TableCell className="text-center">
                        {hasConflict ? (
                          <span className="inline-flex items-center gap-0.5 text-xs font-bold text-red-600">
                            <ShieldAlert className="h-3 w-3" />
                            <span>{conflictCount}</span>
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-emerald-600">0</span>
                        )}
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectCandidate(c);
                          }}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          title="Inspect candidate block details"
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
          <div className="p-3 bg-muted/20 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="text-muted-foreground">
              Showing <span className="font-bold text-foreground">{startRecord}–{endRecord}</span> of{" "}
              <span className="font-bold text-foreground">{totalCandidates}</span> candidates
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

              <div className="text-muted-foreground text-xs px-1">
                Page <span className="font-bold text-foreground">{page}</span> of{" "}
                <span className="font-bold text-foreground">{totalPages || 1}</span>
              </div>

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
        </>
      )}
    </div>
  );
}
