"use client";

import React, { Suspense, useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "react-oidc-context";
import { buildAuthUser } from "@/lib/auth-config";
import { getMaintenanceTasks } from "@/lib/api/maintenance";
import { MaintenanceTask } from "@/lib/types/maintenance";

import { MaintenanceSummaryStrip } from "@/components/maintenance/maintenance-summary-strip";
import { MaintenanceFilters, MaintenanceFilterState } from "@/components/maintenance/maintenance-filters";
import { MaintenanceTable } from "@/components/maintenance/maintenance-table";
import { TaskDetailDrawer } from "@/components/maintenance/task-detail-drawer";
import { LoadingState } from "@/components/feedback/loading-state";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Calendar, Cpu, RefreshCw, TramFront, User as UserIcon, Wrench } from "lucide-react";

const INITIAL_FILTERS: MaintenanceFilterState = {
  search: "",
  department: "",
  severity: "",
  status: "",
  sectionId: "",
  overdueOnly: false,
};

function MaintenanceContent() {
  const auth = useAuth();
  const user = buildAuthUser(auth.user);
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  // Read initial URL query parameters safely
  const paramSeverity = searchParams?.get("severity") || "";
  const paramDept = searchParams?.get("department") || "";
  const paramSection =
    searchParams?.get("section_id") || searchParams?.get("section") || searchParams?.get("sectionId") || "";
  const paramStatus = searchParams?.get("status") || "";
  const paramOverdue = searchParams?.get("overdue") === "true";
  const paramSearch = searchParams?.get("search") || "";

  let initialSeverity = paramSeverity;
  if (paramSeverity.toLowerCase() === "critical") initialSeverity = "Critical";
  else if (paramSeverity.toLowerCase() === "high") initialSeverity = "High";
  else if (paramSeverity.toLowerCase() === "medium") initialSeverity = "Medium";
  else if (paramSeverity.toLowerCase() === "low") initialSeverity = "Low";

  const [filters, setFilters] = useState<MaintenanceFilterState>({
    search: paramSearch,
    department: paramDept,
    severity: initialSeverity,
    status: paramStatus,
    sectionId: paramSection,
    overdueOnly: paramOverdue,
  });

  // Sync state if searchParams change dynamically
  useEffect(() => {
    if (paramSeverity || paramDept || paramSection || paramStatus || paramOverdue || paramSearch) {
      setFilters({
        search: paramSearch,
        department: paramDept,
        severity: initialSeverity,
        status: paramStatus,
        sectionId: paramSection,
        overdueOnly: paramOverdue,
      });
      setPage(1);
    }
  }, [paramSeverity, paramDept, paramSection, paramStatus, paramOverdue, paramSearch, initialSeverity]);

  const [page, setPage] = useState<number>(1);
  const pageSize = 15;

  const [selectedTask, setSelectedTask] = useState<MaintenanceTask | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // 1. Full division tasks query for accurate summary strip & available sections list
  const summaryQuery = useQuery({
    queryKey: ["maintenance-tasks", "division-summary"],
    queryFn: () => getMaintenanceTasks({ page: 1, page_size: 100 }),
  });

  // 2. Server-side filtered query
  const serverParams = useMemo(() => {
    return {
      page: 1,
      page_size: 100, // Fetch up to 100 matching server filter to allow responsive client search & overdue filtering
      department: filters.department || undefined,
      severity: filters.severity || undefined,
      status: filters.status || undefined,
      section_id: filters.sectionId || undefined,
    };
  }, [filters.department, filters.severity, filters.status, filters.sectionId]);

  const tasksQuery = useQuery({
    queryKey: ["maintenance-tasks", "filtered-list", serverParams],
    queryFn: () => getMaintenanceTasks(serverParams),
  });

  // Extract metrics from summary query
  const allSummaryTasks = summaryQuery.data?.items || [];
  const totalDivisionTasks = summaryQuery.data?.total || allSummaryTasks.length;
  const criticalCount = allSummaryTasks.filter((t) => t.severity === "Critical").length;
  const highCount = allSummaryTasks.filter((t) => t.severity === "High").length;
  const overdueCount = allSummaryTasks.filter((t) => (t.days_overdue || 0) > 0).length;
  const openCount = allSummaryTasks.filter(
    (t) => t.status === "Open" || t.status === "InProgress"
  ).length;

  const availableSections = useMemo(() => {
    const set = new Set<string>();
    allSummaryTasks.forEach((t) => {
      if (t.section_id) set.add(t.section_id);
    });
    return Array.from(set).sort();
  }, [allSummaryTasks]);

  // Apply client search and overdue filter on the returned items
  const filteredTasks = useMemo(() => {
    const raw = tasksQuery.data?.items || [];
    return raw.filter((task) => {
      if (filters.overdueOnly && (task.days_overdue || 0) <= 0) {
        return false;
      }
      if (filters.search) {
        const q = filters.search.toLowerCase().trim();
        const matchId = task.task_id.toLowerCase().includes(q);
        const matchDefect = (task.defect_type || "").toLowerCase().includes(q);
        const matchAsset = (task.asset_id || "").toLowerCase().includes(q);
        const matchSec = (task.section_id || "").toLowerCase().includes(q);
        if (!matchId && !matchDefect && !matchAsset && !matchSec) {
          return false;
        }
      }
      return true;
    });
  }, [tasksQuery.data?.items, filters.overdueOnly, filters.search]);

  // Client-side pagination over the filtered subset
  const totalFilteredCount = filteredTasks.length;
  const totalPages = Math.ceil(totalFilteredCount / pageSize) || 1;
  const pagedTasks = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTasks.slice(start, start + pageSize);
  }, [filteredTasks, page, pageSize]);

  const handleFilterChange = (newFilters: MaintenanceFilterState) => {
    setFilters(newFilters);
    setPage(1); // Reset page on filter change
  };

  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
    setPage(1);
  };

  const handleSelectTask = (task: MaintenanceTask) => {
    setSelectedTask(task);
    setIsDrawerOpen(true);
  };

  const handleRefresh = async () => {
    await Promise.all([
      summaryQuery.refetch(),
      tasksQuery.refetch(),
    ]);
  };

  const isPlannerOrAdmin = user?.roles.includes("PLANNER") || user?.roles.includes("ADMIN");

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* 1. Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-900 text-white dark:bg-slate-800 px-2.5 py-1 rounded text-xs font-bold tracking-wider">
              <TramFront className="h-3.5 w-3.5 text-blue-400" />
              <span>HOWRAH DIVISION (HWH)</span>
            </div>
            <span className="rounded px-2 py-0.5 uppercase tracking-wider text-[11px] font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900">
              Eastern Railway
            </span>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded border border-border">
              <Wrench className="h-3 w-3 text-blue-600" />
              <span>Maintenance Decision Support</span>
            </div>
          </div>

          <h1 className="text-xl font-bold tracking-tight text-foreground pt-1">
            Maintenance Management & Defect Workbench
          </h1>
          <p className="text-xs text-muted-foreground">
            Explore active work orders, inspect four-factor priority scoring, and screen co-located cross-department opportunities.
          </p>
        </div>

        {/* User Identity & Global Actions */}
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded text-xs text-muted-foreground">
            <UserIcon className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold text-foreground">
              {user?.name || user?.username || "Authorized User"}
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

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={summaryQuery.isFetching || tasksQuery.isFetching}
            className="h-8 gap-1.5 text-xs bg-card hover:bg-muted"
            title="Refresh maintenance data"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${
                summaryQuery.isFetching || tasksQuery.isFetching ? "animate-spin text-primary" : ""
              }`}
            />
            <span>{summaryQuery.isFetching || tasksQuery.isFetching ? "Updating..." : "Refresh"}</span>
          </Button>

          {isPlannerOrAdmin && (
            <Link href="/planning">
              <Button size="sm" className="h-8 gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white">
                <Cpu className="h-3.5 w-3.5" />
                <span>Open Planning</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* 2. Summary KPI Strip */}
      <MaintenanceSummaryStrip
        totalTasks={totalDivisionTasks}
        criticalCount={criticalCount}
        highCount={highCount}
        overdueCount={overdueCount}
        openCount={openCount}
        isLoading={summaryQuery.isLoading && !summaryQuery.data}
      />

      {/* 3. Filters Bar */}
      <MaintenanceFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={handleResetFilters}
        availableSections={availableSections}
      />

      {/* 4. Task Table */}
      <MaintenanceTable
        tasks={pagedTasks}
        totalTasks={totalFilteredCount}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        onPageChange={(p) => setPage(p)}
        selectedTaskId={selectedTask?.task_id || null}
        onSelectTask={handleSelectTask}
        isLoading={tasksQuery.isLoading && !tasksQuery.data}
        isError={tasksQuery.isError}
        errorMessage={tasksQuery.error instanceof Error ? tasksQuery.error.message : undefined}
        onRetry={() => tasksQuery.refetch()}
      />

      {/* 5. Slide-Over Detail Drawer */}
      <TaskDetailDrawer
        task={selectedTask}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </div>
  );
}

export default function MaintenancePage() {
  return (
    <Suspense fallback={<LoadingState message="Loading Maintenance Workbench..." />}>
      <MaintenanceContent />
    </Suspense>
  );
}
