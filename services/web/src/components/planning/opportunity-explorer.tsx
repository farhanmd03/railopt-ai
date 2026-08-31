"use client";

import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { IntegrationOpportunity } from "@/lib/types/maintenance";
import { formatDuration, formatScore } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  Layers,
  RotateCcw,
  Search,
  Shuffle,
} from "lucide-react";

export interface OpportunityFilterState {
  search: string;
  sectionId: string;
  department: string;
  crossDeptOnly: boolean;
  minPriority: string;
}

interface OpportunityExplorerProps {
  opportunities: IntegrationOpportunity[];
  totalOpportunities: number;
  page: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  filters: OpportunityFilterState;
  onFilterChange: (filters: OpportunityFilterState) => void;
  onResetFilters: () => void;
  selectedOpportunityId: string | null;
  onSelectOpportunity: (opportunity: IntegrationOpportunity) => void;
  availableSections?: string[];
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
}

export function OpportunityExplorer({
  opportunities,
  totalOpportunities,
  page,
  pageSize,
  totalPages,
  onPageChange,
  filters,
  onFilterChange,
  onResetFilters,
  selectedOpportunityId,
  onSelectOpportunity,
  availableSections = [],
  isLoading,
  isError,
  errorMessage,
  onRetry,
}: OpportunityExplorerProps) {
  const hasActiveFilters =
    Boolean(filters.search) ||
    Boolean(filters.sectionId) ||
    Boolean(filters.department) ||
    filters.crossDeptOnly ||
    Boolean(filters.minPriority);

  const startRecord = (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, totalOpportunities);

  return (
    <div className="bg-card border border-border rounded shadow-xs overflow-hidden space-y-0">
      {/* Header & Filter Bar */}
      <div className="p-3.5 border-b border-border bg-muted/20 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-purple-600 shrink-0" />
            <div>
              <span className="text-xs font-bold text-foreground block">
                Integration Opportunities Explorer
              </span>
              <span className="text-[11px] text-muted-foreground">
                Screened co-located maintenance combinations eligible for joint corridor possessions.
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
              <span>Reset</span>
            </Button>
          )}
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-1">
          {/* Search */}
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search Opportunity ID, tasks..."
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
                aria-label="Filter by section"
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

          {/* Department Filter */}
          <div>
            <select
              value={filters.department}
              onChange={(e) => onFilterChange({ ...filters, department: e.target.value })}
              aria-label="Filter by department"
              className="h-8 w-full rounded border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Departments</option>
              <option value="Engineering">Engineering</option>
              <option value="S&T">S&T</option>
              <option value="TRD">TRD</option>
            </select>
          </div>

          {/* Min Priority */}
          <div>
            <Input
              type="number"
              placeholder="Min Total Priority (e.g. 100)"
              value={filters.minPriority}
              onChange={(e) => onFilterChange({ ...filters, minPriority: e.target.value })}
              className="h-8 text-xs bg-background"
            />
          </div>

          {/* Cross-Department Toggle */}
          <div className="flex items-center">
            <label className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground hover:text-foreground select-none">
              <input
                type="checkbox"
                checked={filters.crossDeptOnly}
                onChange={(e) => onFilterChange({ ...filters, crossDeptOnly: e.target.checked })}
                className="rounded border-input text-purple-600 focus:ring-ring h-3.5 w-3.5"
              />
              <Shuffle className="h-3 w-3 text-indigo-500" />
              <span>Cross-dept only</span>
            </label>
          </div>
        </div>
      </div>

      {/* Main Content / Table */}
      {isLoading ? (
        <div className="p-6">
          <LoadingState message="Screening section integration opportunities..." rows={6} />
        </div>
      ) : isError ? (
        <div className="p-6">
          <ErrorState
            title="Failed to load integration opportunities"
            message={errorMessage || "Unable to retrieve opportunities from backend."}
            onRetry={onRetry}
          />
        </div>
      ) : opportunities.length === 0 ? (
        <div className="p-6">
          <EmptyState
            title="No integration opportunities match your filters"
            description="Try adjusting your section, department, or priority parameters."
            icon={<Layers className="h-6 w-6" />}
          />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-[200px] text-xs font-bold">Opportunity ID</TableHead>
                  <TableHead className="text-xs font-bold">Section</TableHead>
                  <TableHead className="text-xs font-bold">Tasks Included</TableHead>
                  <TableHead className="text-xs font-bold">Departments Involved</TableHead>
                  <TableHead className="text-xs font-bold text-center">Compatibility</TableHead>
                  <TableHead className="text-xs font-bold text-right">Combined Duration</TableHead>
                  <TableHead className="text-xs font-bold text-right" title="Sum of task priority values in this opportunity">
                    Total Priority Value
                  </TableHead>
                  <TableHead className="w-[60px] text-xs font-bold text-center">Inspect</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {opportunities.map((opp) => {
                  const isSelected = selectedOpportunityId === opp.opportunity_id;
                  const depts = opp.departments_involved || [];

                  return (
                    <TableRow
                      key={opp.opportunity_id}
                      onClick={() => onSelectOpportunity(opp)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelectOpportunity(opp);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-pressed={isSelected}
                      className={`cursor-pointer transition-colors focus:outline-none focus:bg-muted/50 ${
                        isSelected
                          ? "bg-purple-50/80 dark:bg-purple-950/40 border-l-2 border-l-purple-600"
                          : "hover:bg-muted/30"
                      }`}
                    >
                      <TableCell className="font-mono text-xs font-bold text-foreground">
                        {opp.opportunity_id}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {opp.section_id}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        <span className="font-semibold text-foreground">{opp.task_ids.length} tasks</span>
                        <span className="text-[11px] ml-1">({opp.task_ids.join(", ")})</span>
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
                      <TableCell className="text-center">
                        <span className="rounded bg-purple-50 dark:bg-purple-950 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          {opp.compatibility_score}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-foreground font-medium">
                        {formatDuration(opp.combined_duration_hrs)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-extrabold text-foreground">
                        {formatScore(opp.priority_summary?.total_priority_value)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectOpportunity(opp);
                          }}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          title="Inspect opportunity details"
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
              <span className="font-bold text-foreground">{totalOpportunities}</span> opportunities
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
