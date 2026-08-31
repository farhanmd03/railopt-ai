"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "react-oidc-context";
import { buildAuthUser } from "@/lib/auth-config";
import { getOptimizationRuns, getOptimizationRun, getOptimizedBlocks } from "@/lib/api/optimization";
import { getSections } from "@/lib/api/sections";
import { OptimizedBlock, OptimizationRun } from "@/lib/types/optimization";
import { CalendarHeader, CalendarViewMode } from "@/components/planning/calendar/calendar-header";
import { CalendarFilters, CalendarFilterState } from "@/components/planning/calendar/calendar-filters";
import { WeekView } from "@/components/planning/calendar/week-view";
import { MonthView } from "@/components/planning/calendar/month-view";
import { ScheduleTimelineView } from "@/components/planning/calendar/schedule-timeline-view";
import { UnassignedTasksAlert } from "@/components/planning/calendar/unassigned-tasks-alert";
import { OptimizedBlockDetailDrawer } from "@/components/optimization/optimized-block-detail-drawer";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { Calendar as CalendarIcon, Cpu, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

function CalendarPlanningPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const auth = useAuth();
  const user = buildAuthUser(auth.user);

  // URL search params
  const paramRun = searchParams.get("run") || "";
  const paramSection = searchParams.get("section") || "";
  const paramView = (searchParams.get("view") as CalendarViewMode) || "week";

  // View state
  const [viewMode, setViewMode] = useState<CalendarViewMode>(paramView);
  const [selectedRunId, setSelectedRunId] = useState<string>(paramRun);
  const [selectedBlock, setSelectedBlock] = useState<OptimizedBlock | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Current calendar anchor date
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  // Filter state
  const [filters, setFilters] = useState<CalendarFilterState>({
    sectionId: paramSection,
    department: "",
    integratedOnly: false,
    searchQuery: "",
  });

  // 1. Fetch Optimization Runs
  const runsQuery = useQuery({
    queryKey: ["planning-calendar-runs"],
    queryFn: () => getOptimizationRuns({ page_size: 10 }),
  });

  const runs = useMemo(() => runsQuery.data?.items || [], [runsQuery.data]);

  // Determine effective run ID (from state, query param, or fallback to first available run)
  const effectiveRunId = useMemo(() => {
    if (selectedRunId) return selectedRunId;
    if (runs.length > 0) return runs[0].id.toString();
    return "";
  }, [selectedRunId, runs]);

  // 2. Fetch Active Optimization Run Details
  const runDetailQuery = useQuery({
    queryKey: ["planning-calendar-run-detail", effectiveRunId],
    queryFn: () => getOptimizationRun(effectiveRunId),
    enabled: !!effectiveRunId,
  });

  const activeRun: OptimizationRun | null = runDetailQuery.data || null;

  // Set initial calendar date to match planning horizon start
  useEffect(() => {
    if (activeRun?.planning_horizon_start) {
      try {
        const horizonD = new Date(activeRun.planning_horizon_start);
        if (!isNaN(horizonD.getTime())) {
          setCurrentDate(horizonD);
        }
      } catch {
        // keep current date
      }
    }
  }, [activeRun?.planning_horizon_start]);

  // 3. Fetch Scheduled Blocks for Selected Run
  const blocksQuery = useQuery({
    queryKey: ["planning-calendar-blocks", effectiveRunId],
    queryFn: () => getOptimizedBlocks(effectiveRunId, { page_size: 100 }),
    enabled: !!effectiveRunId,
  });

  const rawBlocks = useMemo(() => blocksQuery.data?.items || [], [blocksQuery.data]);

  // 4. Fetch Sections for Filter Dropdown
  const sectionsQuery = useQuery({
    queryKey: ["planning-calendar-sections"],
    queryFn: () => getSections(),
  });

  const availableSections = useMemo(
    () =>
      (sectionsQuery.data?.items || []).map((s) => ({
        section_id: s.section_id,
        section_name: s.section_name,
      })),
    [sectionsQuery.data]
  );

  // Compute Monday of current week
  const currentWeekStart = useMemo(() => {
    const d = new Date(currentDate);
    const dayOfWeek = d.getUTCDay(); // 0 = Sun, 1 = Mon ...
    const diff = d.getUTCDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const mon = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
    return mon;
  }, [currentDate]);

  // Period Navigation handlers
  const handlePrevPeriod = () => {
    const nextD = new Date(currentDate);
    if (viewMode === "month") {
      nextD.setUTCMonth(nextD.getUTCMonth() - 1);
    } else {
      nextD.setUTCDate(nextD.getUTCDate() - 7);
    }
    setCurrentDate(nextD);
  };

  const handleNextPeriod = () => {
    const nextD = new Date(currentDate);
    if (viewMode === "month") {
      nextD.setUTCMonth(nextD.getUTCMonth() + 1);
    } else {
      nextD.setUTCDate(nextD.getUTCDate() + 7);
    }
    setCurrentDate(nextD);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Period Title formatting
  const periodTitle = useMemo(() => {
    if (viewMode === "month") {
      return currentDate.toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
    }

    const weekEnd = new Date(currentWeekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);

    const startFormatted = currentWeekStart.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      timeZone: "UTC",
    });
    const endFormatted = weekEnd.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });

    return `${startFormatted} – ${endFormatted}`;
  }, [viewMode, currentDate, currentWeekStart]);

  // Filtered blocks
  const filteredBlocks = useMemo(() => {
    return rawBlocks.filter((block) => {
      // Section filter
      if (filters.sectionId && block.section_id !== filters.sectionId) return false;

      // Department filter
      if (filters.department && !block.departments_involved.includes(filters.department)) {
        return false;
      }

      // Integrated only
      if (filters.integratedOnly && !block.is_integrated) return false;

      // Search query filter (matches block ID, section, or task ID)
      if (filters.searchQuery.trim()) {
        const q = filters.searchQuery.trim().toLowerCase();
        const matchesBlockId = block.optimized_block_id.toLowerCase().includes(q);
        const matchesSection = block.section_id.toLowerCase().includes(q);
        const matchesTask = block.task_ids.some((tid) => tid.toLowerCase().includes(q));
        if (!matchesBlockId && !matchesSection && !matchesTask) return false;
      }

      return true;
    });
  }, [rawBlocks, filters]);

  // Handle block selection
  const handleSelectBlock = (block: OptimizedBlock) => {
    setSelectedBlock(block);
    setIsDrawerOpen(true);
  };

  // Loading state
  const isLoading = runsQuery.isLoading || (!!effectiveRunId && (runDetailQuery.isLoading || blocksQuery.isLoading));

  if (isLoading && !runsQuery.data) {
    return (
      <div className="space-y-6">
        <LoadingState message="Loading Optimization Plans and Corridor Schedules..." />
      </div>
    );
  }

  // Error state
  if (runsQuery.isError) {
    return (
      <div className="space-y-6">
        <ErrorState
          title="Failed to Load Maintenance Schedule"
          message="Could not retrieve persisted optimization runs from server."
          onRetry={() => runsQuery.refetch()}
        />
      </div>
    );
  }

  // No runs empty state
  if (runs.length === 0) {
    return (
      <div className="space-y-6">
        <CalendarHeader
          user={user}
          runs={[]}
          selectedRunId=""
          onSelectRunId={() => {}}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          periodTitle={periodTitle}
          onPrevPeriod={handlePrevPeriod}
          onNextPeriod={handleNextPeriod}
          onToday={handleToday}
          activeRun={null}
        />
        <EmptyState
          title="No Optimization Plans Available"
          description="There are currently no persistent OR-Tools optimization runs available for calendar visualization. Generate an optimal corridor schedule in the Optimization Planner."
          icon={<CalendarIcon className="h-6 w-6" />}
          action={
            <Link href="/optimization">
              <Button className="bg-primary text-primary-foreground text-xs gap-1.5">
                <Cpu className="h-4 w-4" />
                <span>Open Optimization Planner</span>
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 1. Planning Header with Run Selector and Period Nav */}
      <CalendarHeader
        user={user}
        runs={runs}
        selectedRunId={effectiveRunId}
        onSelectRunId={(id) => {
          setSelectedRunId(id);
          router.replace(`/planning/calendar?run=${id}`);
        }}
        viewMode={viewMode}
        onViewModeChange={(m) => {
          setViewMode(m);
        }}
        periodTitle={periodTitle}
        onPrevPeriod={handlePrevPeriod}
        onNextPeriod={handleNextPeriod}
        onToday={handleToday}
        activeRun={activeRun}
      />

      {/* 2. Unassigned Tasks Alert */}
      {activeRun && activeRun.tasks_unassigned > 0 && (
        <UnassignedTasksAlert
          unassignedCount={activeRun.tasks_unassigned}
          unassignedTaskIds={activeRun.unassigned_task_ids || []}
        />
      )}

      {/* 3. Calendar Filters Bar */}
      <CalendarFilters
        filters={filters}
        onFilterChange={setFilters}
        onResetFilters={() =>
          setFilters({
            sectionId: "",
            department: "",
            integratedOnly: false,
            searchQuery: "",
          })
        }
        availableSections={availableSections}
      />

      {/* 4. Active View Rendering */}
      {rawBlocks.length === 0 ? (
        <div className="bg-card border border-border rounded p-8 text-center space-y-3">
          <div className="mx-auto h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            <CalendarIcon className="h-5 w-5" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto text-xs">
            <p className="font-bold text-foreground">No Optimized Blocks in Selected Plan</p>
            <p className="text-muted-foreground">
              This optimization run contains zero scheduled possession blocks.
            </p>
          </div>
        </div>
      ) : (
        <>
          {viewMode === "week" && (
            <WeekView
              currentWeekStart={currentWeekStart}
              blocks={filteredBlocks}
              selectedBlockId={selectedBlock?.optimized_block_id || null}
              onSelectBlock={handleSelectBlock}
            />
          )}

          {viewMode === "month" && (
            <MonthView
              currentMonthDate={currentDate}
              blocks={filteredBlocks}
              selectedBlockId={selectedBlock?.optimized_block_id || null}
              onSelectBlock={handleSelectBlock}
            />
          )}

          {viewMode === "schedule" && (
            <ScheduleTimelineView
              blocks={filteredBlocks}
              selectedBlockId={selectedBlock?.optimized_block_id || null}
              onSelectBlock={handleSelectBlock}
            />
          )}
        </>
      )}

      {/* 5. Slide-Over Block Detail Drawer */}
      <OptimizedBlockDetailDrawer
        block={selectedBlock}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </div>
  );
}

export default function PlanningCalendarPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <LoadingState message="Initializing Corridor Planning Calendar..." />
        </div>
      }
    >
      <CalendarPlanningPageContent />
    </Suspense>
  );
}
