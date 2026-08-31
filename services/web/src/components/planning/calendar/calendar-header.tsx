"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthUser } from "@/lib/auth-config";
import { OptimizationRun } from "@/lib/types/optimization";
import { formatScore, formatDuration } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  Calendar as CalendarIcon,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cpu,
  ExternalLink,
  Layers,
  MapPin,
  Sparkles,
  Train,
  User as UserIcon,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export type CalendarViewMode = "week" | "month" | "schedule";

interface CalendarHeaderProps {
  user: AuthUser | null;
  runs: OptimizationRun[];
  selectedRunId: string;
  onSelectRunId: (runId: string) => void;
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  periodTitle: string;
  onPrevPeriod: () => void;
  onNextPeriod: () => void;
  onToday: () => void;
  activeRun: OptimizationRun | null;
}

export function CalendarHeader({
  user,
  runs,
  selectedRunId,
  onSelectRunId,
  viewMode,
  onViewModeChange,
  periodTitle,
  onPrevPeriod,
  onNextPeriod,
  onToday,
  activeRun,
}: CalendarHeaderProps) {
  const pathname = usePathname();

  return (
    <div className="space-y-3 pb-3 border-b border-border">
      {/* 1. Sub-navigation Tabs */}
      <div className="flex items-center justify-between gap-4 border-b border-border pb-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Link
            href="/planning"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
              pathname === "/planning"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Integration & Candidate Windows</span>
          </Link>

          <Link
            href="/planning/calendar"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
              pathname === "/planning/calendar"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            }`}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            <span>Weekly / Monthly Schedule</span>
          </Link>
        </div>

        {/* User Identity Banner */}
        <div className="flex items-center gap-2 bg-card border border-border px-2.5 py-1 rounded text-xs text-muted-foreground">
          <UserIcon className="h-3.5 w-3.5 text-primary" />
          <span className="font-semibold text-foreground">
            {user?.name || user?.username || "Operations Planner"}
          </span>
          <div className="flex gap-1">
            {user?.roles.map((r) => (
              <span
                key={r}
                className="rounded bg-blue-50 dark:bg-blue-950 px-1.5 py-0.2 text-[10px] font-bold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
              >
                {r}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Top Title & Division Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pt-1">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-900 text-white dark:bg-slate-800 px-2.5 py-0.5 rounded text-xs font-bold tracking-wider">
              <Train className="h-3.5 w-3.5 text-blue-400" />
              <span>HOWRAH DIVISION (HWH)</span>
            </div>
            <span className="rounded px-2 py-0.5 uppercase tracking-wider text-[11px] font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900">
              Eastern Railway
            </span>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded border border-border">
              <Clock className="h-3 w-3 text-blue-600" />
              <span>Temporal Planning Horizon</span>
            </div>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Corridor Maintenance Schedule & Calendar
          </h1>
          <p className="text-xs text-muted-foreground">
            Temporal visualization of optimized track possessions across days, weeks, and sections.
          </p>
        </div>

        {/* Optimization Run Selector & Summary */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {runs.length > 0 ? (
            <div className="flex items-center gap-2 bg-muted/30 border border-border p-1.5 rounded">
              <span className="text-[11px] font-bold text-muted-foreground uppercase pl-1">
                Active Plan:
              </span>
              <select
                value={selectedRunId}
                onChange={(e) => onSelectRunId(e.target.value)}
                className="h-7 px-2 bg-background border border-input rounded text-xs font-mono font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                aria-label="Select Optimization Run"
              >
                {runs.map((r) => (
                  <option key={r.id} value={r.id.toString()}>
                    {r.run_id} ({r.solver_status}) — {r.tasks_scheduled} tasks
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground bg-muted/40 px-3 py-1.5 rounded border border-border">
              No persistent runs found
            </div>
          )}

          {activeRun && (
            <div className="flex items-center gap-2">
              <Link
                href={`/map?run=${activeRun.id}`}
                className="inline-flex items-center gap-1.5 bg-card border border-border hover:bg-muted px-2.5 py-1.5 rounded text-xs font-semibold text-foreground transition-colors shadow-xs"
              >
                <MapPin className="h-3.5 w-3.5 text-blue-600" />
                <span>View on Map</span>
              </Link>
              <Link
                href={`/optimization/runs/${activeRun.id}`}
                className="inline-flex items-center gap-1.5 bg-card border border-border hover:bg-muted px-2.5 py-1.5 rounded text-xs font-semibold text-foreground transition-colors shadow-xs"
              >
                <Cpu className="h-3.5 w-3.5 text-purple-600" />
                <span>Solver Details</span>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* 3. Run Context & Solver Disclaimer Banner */}
      {activeRun && (
        <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded p-2.5 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-blue-950 dark:text-blue-200">
              Run: {activeRun.run_id}
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              Solver Status: {activeRun.solver_status}
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="text-foreground">
              Scheduled: <strong>{activeRun.tasks_scheduled}</strong> / {activeRun.tasks_considered} tasks ({(activeRun.integrated_block_count || 0) + (activeRun.separate_block_count || 0)} blocks)
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="text-purple-700 dark:text-purple-300 font-semibold">
              {activeRun.integrated_block_count} Joint Possessions
            </span>
          </div>

          <div className="text-[11px] text-muted-foreground italic">
            Optimization result — requires human planning & operational review.
          </div>
        </div>
      )}

      {/* 4. Controls: Prev/Next/Today & View Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
        {/* Period Navigation */}
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-border rounded bg-card shadow-xs">
            <Button
              variant="ghost"
              size="sm"
              onClick={onPrevPeriod}
              aria-label="Previous Period"
              className="h-8 w-8 p-0 rounded-r-none hover:bg-muted"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToday}
              className="h-8 px-3 text-xs font-semibold rounded-none border-x border-border hover:bg-muted"
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onNextPeriod}
              aria-label="Next Period"
              className="h-8 w-8 p-0 rounded-l-none hover:bg-muted"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <h2 className="text-sm font-bold text-foreground pl-1">
            {periodTitle}
          </h2>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded border border-border self-start sm:self-auto">
          <Button
            variant={viewMode === "week" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewModeChange("week")}
            className={`h-7 px-3 text-xs font-semibold ${
              viewMode === "week"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Week View
          </Button>

          <Button
            variant={viewMode === "month" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewModeChange("month")}
            className={`h-7 px-3 text-xs font-semibold ${
              viewMode === "month"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Month View
          </Button>

          <Button
            variant={viewMode === "schedule" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewModeChange("schedule")}
            className={`h-7 px-3 text-xs font-semibold ${
              viewMode === "schedule"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Schedule View
          </Button>
        </div>
      </div>
    </div>
  );
}
