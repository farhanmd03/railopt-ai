"use client";

import React from "react";
import { Filter, RotateCcw, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface CalendarFilterState {
  sectionId: string;
  department: string;
  integratedOnly: boolean;
  searchQuery: string;
}

interface CalendarFiltersProps {
  filters: CalendarFilterState;
  onFilterChange: (filters: CalendarFilterState) => void;
  onResetFilters: () => void;
  availableSections: { section_id: string; section_name: string }[];
}

export function CalendarFilters({
  filters,
  onFilterChange,
  onResetFilters,
  availableSections,
}: CalendarFiltersProps) {
  const isFiltered =
    filters.sectionId !== "" ||
    filters.department !== "" ||
    filters.integratedOnly ||
    filters.searchQuery !== "";

  return (
    <div className="bg-card border border-border rounded p-3 shadow-xs space-y-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap pb-1.5 border-b border-border">
        <div className="flex items-center gap-1.5">
          <Filter className="h-4 w-4 text-blue-600" />
          <span className="text-xs font-bold text-foreground">Schedule Filters</span>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
        {/* 1. Search Query */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
            Search Block / Task ID
          </label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="e.g. OPT-BLK-0001, WO-0001"
              value={filters.searchQuery}
              onChange={(e) => onFilterChange({ ...filters, searchQuery: e.target.value })}
              className="w-full h-8 pl-8 pr-2 py-1 bg-background border border-input rounded text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label="Search Block or Task ID"
            />
          </div>
        </div>

        {/* 2. Section Filter */}
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

        {/* 3. Department Filter */}
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
            <option value="S&T">S&T (Signals & Telecom)</option>
            <option value="TRD">TRD (Traction Distribution / OHE)</option>
          </select>
        </div>

        {/* 4. Integrated Toggle */}
        <div className="flex items-center pt-5">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-foreground select-none">
            <input
              type="checkbox"
              checked={filters.integratedOnly}
              onChange={(e) => onFilterChange({ ...filters, integratedOnly: e.target.checked })}
              className="rounded border-input text-purple-600 focus:ring-ring h-4 w-4 cursor-pointer"
            />
            <span className="text-purple-700 dark:text-purple-300">Integrated Multi-Dept Only</span>
          </label>
        </div>
      </div>
    </div>
  );
}
