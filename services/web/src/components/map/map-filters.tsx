"use client";

import React from "react";
import { Filter, RotateCcw, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface MapFilterState {
  sectionId: string;
  department: string;
  severity: string;
  status: string;
  integratedOnly: boolean;
  runId: string;
}

interface MapFiltersProps {
  filters: MapFilterState;
  onFilterChange: (filters: MapFilterState) => void;
  onResetFilters: () => void;
  availableSections: { section_id: string; section_name: string }[];
  availableRuns: { id: number; run_id: string; solver_status: string }[];
}

export function MapFilters({
  filters,
  onFilterChange,
  onResetFilters,
  availableSections,
  availableRuns,
}: MapFiltersProps) {
  const isFiltered =
    filters.sectionId !== "" ||
    filters.department !== "" ||
    filters.severity !== "" ||
    filters.status !== "" ||
    filters.integratedOnly ||
    filters.runId !== "";

  return (
    <div className="bg-card border border-border rounded p-3 shadow-xs space-y-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap pb-1.5 border-b border-border">
        <div className="flex items-center gap-1.5">
          <Filter className="h-4 w-4 text-blue-600" />
          <span className="text-xs font-bold text-foreground">Spatial & Operational Filters</span>
        </div>
        {isFiltered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetFilters}
            className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            <span>Reset Filters</span>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
        {/* 1. Section Filter */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
            Railway Section
          </label>
          <select
            value={filters.sectionId}
            onChange={(e) => onFilterChange({ ...filters, sectionId: e.target.value })}
            className="w-full h-8 px-2 py-1 bg-background border border-input rounded text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            aria-label="Filter by Railway Section"
          >
            <option value="">All Sections</option>
            {availableSections.map((sec) => (
              <option key={sec.section_id} value={sec.section_id}>
                {sec.section_id} - {sec.section_name}
              </option>
            ))}
          </select>
        </div>

        {/* 2. Department Filter */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
            Department
          </label>
          <select
            value={filters.department}
            onChange={(e) => onFilterChange({ ...filters, department: e.target.value })}
            className="w-full h-8 px-2 py-1 bg-background border border-input rounded text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            aria-label="Filter by Department"
          >
            <option value="">All Departments</option>
            <option value="Engineering">Engineering (Track)</option>
            <option value="S&T">S&T (Signals)</option>
            <option value="TRD">TRD (OHE / Traction)</option>
          </select>
        </div>

        {/* 3. Severity Filter */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
            Task Severity
          </label>
          <select
            value={filters.severity}
            onChange={(e) => onFilterChange({ ...filters, severity: e.target.value })}
            className="w-full h-8 px-2 py-1 bg-background border border-input rounded text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            aria-label="Filter by Severity"
          >
            <option value="">All Severities</option>
            <option value="CRITICAL">Critical (Score &ge; 70)</option>
            <option value="HIGH">High (Score 50-69)</option>
            <option value="MEDIUM">Medium (Score 30-49)</option>
            <option value="LOW">Low (Score &lt; 30)</option>
          </select>
        </div>

        {/* 4. Maintenance Status */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
            Maintenance Status
          </label>
          <select
            value={filters.status}
            onChange={(e) => onFilterChange({ ...filters, status: e.target.value })}
            className="w-full h-8 px-2 py-1 bg-background border border-input rounded text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            aria-label="Filter by Maintenance Status"
          >
            <option value="">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Scheduled">Scheduled</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
          </select>
        </div>

        {/* 5. Optimization Run Context */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
            Optimization Run
          </label>
          <select
            value={filters.runId}
            onChange={(e) => onFilterChange({ ...filters, runId: e.target.value })}
            className="w-full h-8 px-2 py-1 bg-background border border-input rounded text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            aria-label="Filter by Optimization Run"
          >
            <option value="">All Persistent Runs</option>
            {availableRuns.map((r) => (
              <option key={r.id} value={r.id.toString()}>
                {r.run_id} ({r.solver_status})
              </option>
            ))}
          </select>
        </div>

        {/* 6. Integrated Toggle */}
        <div className="flex items-center pt-5">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-foreground select-none">
            <input
              type="checkbox"
              checked={filters.integratedOnly}
              onChange={(e) => onFilterChange({ ...filters, integratedOnly: e.target.checked })}
              className="rounded border-input text-purple-600 focus:ring-ring h-4 w-4 cursor-pointer"
            />
            <span className="text-purple-700 dark:text-purple-300">Integrated Only</span>
          </label>
        </div>
      </div>
    </div>
  );
}
