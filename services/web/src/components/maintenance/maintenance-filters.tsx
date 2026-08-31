"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Filter, RotateCcw, Search } from "lucide-react";

export interface MaintenanceFilterState {
  search: string;
  department: string;
  severity: string;
  status: string;
  sectionId: string;
  overdueOnly: boolean;
}

interface MaintenanceFiltersProps {
  filters: MaintenanceFilterState;
  onFilterChange: (filters: MaintenanceFilterState) => void;
  onReset: () => void;
  availableSections?: string[];
}

export function MaintenanceFilters({
  filters,
  onFilterChange,
  onReset,
  availableSections = [],
}: MaintenanceFiltersProps) {
  const hasActiveFilters =
    Boolean(filters.search) ||
    Boolean(filters.department) ||
    Boolean(filters.severity) ||
    Boolean(filters.status) ||
    Boolean(filters.sectionId) ||
    filters.overdueOnly;

  return (
    <div className="bg-card border border-border rounded p-3.5 shadow-xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-blue-600 shrink-0" />
          <span className="text-xs font-bold text-foreground">Filter Work Orders</span>
          {hasActiveFilters && (
            <span className="rounded bg-blue-100 dark:bg-blue-950 px-1.5 py-0.2 text-[10px] font-semibold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              Active Filters
            </span>
          )}
        </div>

        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            className="h-7 text-xs gap-1.5 self-start sm:self-auto text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset Filters</span>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {/* Search */}
        <div className="lg:col-span-2 relative">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search Task ID, defect, asset..."
            value={filters.search}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
            className="h-8 pl-8 text-xs bg-background"
          />
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
            <option value="Engineering">Engineering (Civil/Track)</option>
            <option value="S&T">S&T (Signals & Telecom)</option>
            <option value="TRD">TRD (Electrical/OHE)</option>
          </select>
        </div>

        {/* Severity Filter */}
        <div>
          <select
            value={filters.severity}
            onChange={(e) => onFilterChange({ ...filters, severity: e.target.value })}
            aria-label="Filter by severity"
            className="h-8 w-full rounded border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Severities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={filters.status}
            onChange={(e) => onFilterChange({ ...filters, status: e.target.value })}
            aria-label="Filter by status"
            className="h-8 w-full rounded border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Statuses</option>
            <option value="Open">Open</option>
            <option value="InProgress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        {/* Section / Overdue Filter */}
        <div className="flex items-center gap-2">
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
              placeholder="Section ID (e.g. HOW_SEC_001)"
              value={filters.sectionId}
              onChange={(e) => onFilterChange({ ...filters, sectionId: e.target.value })}
              className="h-8 text-xs bg-background"
            />
          )}
        </div>
      </div>

      {/* Overdue quick toggle */}
      <div className="flex items-center gap-2 pt-1">
        <label className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground hover:text-foreground select-none">
          <input
            type="checkbox"
            checked={filters.overdueOnly}
            onChange={(e) => onFilterChange({ ...filters, overdueOnly: e.target.checked })}
            className="rounded border-input text-blue-600 focus:ring-ring h-3.5 w-3.5"
          />
          <span>Show overdue backlog only</span>
        </label>
      </div>
    </div>
  );
}
