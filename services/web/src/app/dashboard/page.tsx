"use client";

import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "react-oidc-context";
import { buildAuthUser } from "@/lib/auth-config";
import { getMaintenanceTasks, getIntegrationOpportunities } from "@/lib/api/maintenance";
import { getCandidateBlocks } from "@/lib/api/candidate-blocks";
import { getOptimizationRuns, getOptimizedBlocks } from "@/lib/api/optimization";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { KpiOverview } from "@/components/dashboard/kpi-overview";
import { PriorityDistribution } from "@/components/dashboard/priority-distribution";
import { MaintenanceQueue } from "@/components/dashboard/maintenance-queue";
import { IntegrationOpportunitiesSummary } from "@/components/dashboard/integration-opportunities-summary";
import { CandidateBlocksSummary } from "@/components/dashboard/candidate-blocks-summary";
import { LatestOptimizationRun } from "@/components/dashboard/latest-optimization-run";
import { RecentOptimizedBlocks } from "@/components/dashboard/recent-optimized-blocks";

export default function DashboardPage() {
  const auth = useAuth();
  const user = buildAuthUser(auth.user);
  const queryClient = useQueryClient();

  // 1. Maintenance tasks query (fetch full division task dataset to compute exact metrics)
  const tasksQuery = useQuery({
    queryKey: ["maintenance-tasks", "dashboard-summary"],
    queryFn: () => getMaintenanceTasks({ page: 1, page_size: 100 }),
  });

  // 2. Integration opportunities query
  const opportunitiesQuery = useQuery({
    queryKey: ["integration-opportunities", "dashboard-summary"],
    queryFn: () => getIntegrationOpportunities({ page: 1, page_size: 5 }),
  });

  // 3. Candidate blocks query
  const candidateBlocksQuery = useQuery({
    queryKey: ["candidate-blocks", "dashboard-summary"],
    queryFn: () => getCandidateBlocks({ page: 1, page_size: 5 }),
  });

  // 4. Latest optimization run query
  const latestRunQuery = useQuery({
    queryKey: ["optimization-runs", "latest"],
    queryFn: () => getOptimizationRuns({ page: 1, page_size: 1 }),
  });

  const latestRun = latestRunQuery.data?.items?.[0] || null;
  const latestRunId = latestRun?.id;

  // 5. Optimized blocks for latest run
  const optimizedBlocksQuery = useQuery({
    queryKey: ["optimized-blocks", "latest", latestRunId],
    queryFn: () => getOptimizedBlocks(latestRunId!, { page: 1, page_size: 6 }),
    enabled: !!latestRunId,
  });

  // Aggregated maintenance metrics computed deterministically from real API response
  const allTasks = tasksQuery.data?.items || [];
  const totalTasksCount = tasksQuery.data?.total || allTasks.length;
  const criticalTasksCount = allTasks.filter((t) => t.severity === "Critical").length;
  const highTasksCount = allTasks.filter((t) => t.severity === "High").length;
  const topQueueTasks = allTasks.slice(0, 8);

  const isRefreshing =
    tasksQuery.isFetching ||
    opportunitiesQuery.isFetching ||
    candidateBlocksQuery.isFetching ||
    latestRunQuery.isFetching ||
    optimizedBlocksQuery.isFetching;

  const handleRefresh = async () => {
    await Promise.all([
      tasksQuery.refetch(),
      opportunitiesQuery.refetch(),
      candidateBlocksQuery.refetch(),
      latestRunQuery.refetch(),
      latestRunId ? optimizedBlocksQuery.refetch() : Promise.resolve(),
    ]);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Header & Context */}
      <DashboardHeader
        user={user}
        latestRun={latestRun}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
      />

      {/* 2. KPI Overview */}
      <KpiOverview
        totalTasks={totalTasksCount}
        criticalTasks={criticalTasksCount}
        highTasks={highTasksCount}
        integrationOpportunities={opportunitiesQuery.data?.total}
        candidateBlocks={candidateBlocksQuery.data?.total}
        latestRun={latestRun}
        isLoading={tasksQuery.isLoading && !tasksQuery.data}
      />

      {/* 3. Analytical Overview (2-Column Grid on desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5">
          <PriorityDistribution
            tasks={allTasks}
            isLoading={tasksQuery.isLoading && !tasksQuery.data}
          />
        </div>
        <div className="lg:col-span-7">
          <LatestOptimizationRun
            latestRun={latestRun}
            isLoading={latestRunQuery.isLoading && !latestRunQuery.data}
            isError={latestRunQuery.isError}
            errorMessage={latestRunQuery.error instanceof Error ? latestRunQuery.error.message : undefined}
            onRetry={() => latestRunQuery.refetch()}
          />
        </div>
      </div>

      {/* 4. Operational Tables (Work Queue & Integration Opportunities) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <MaintenanceQueue
          tasks={topQueueTasks}
          totalTasks={totalTasksCount}
          isLoading={tasksQuery.isLoading && !tasksQuery.data}
          isError={tasksQuery.isError}
          errorMessage={tasksQuery.error instanceof Error ? tasksQuery.error.message : undefined}
          onRetry={() => tasksQuery.refetch()}
        />

        <IntegrationOpportunitiesSummary
          opportunities={opportunitiesQuery.data?.items}
          totalOpportunities={opportunitiesQuery.data?.total}
          isLoading={opportunitiesQuery.isLoading && !opportunitiesQuery.data}
          isError={opportunitiesQuery.isError}
          errorMessage={opportunitiesQuery.error instanceof Error ? opportunitiesQuery.error.message : undefined}
          onRetry={() => opportunitiesQuery.refetch()}
        />
      </div>

      {/* 5. Candidate Blocks Summary */}
      <CandidateBlocksSummary
        candidateBlocks={candidateBlocksQuery.data?.items}
        totalCandidates={candidateBlocksQuery.data?.total}
        isLoading={candidateBlocksQuery.isLoading && !candidateBlocksQuery.data}
        isError={candidateBlocksQuery.isError}
        errorMessage={candidateBlocksQuery.error instanceof Error ? candidateBlocksQuery.error.message : undefined}
        onRetry={() => candidateBlocksQuery.refetch()}
      />

      {/* 6. Recent Optimized Blocks (if latest run exists or attempted) */}
      {latestRun && (
        <RecentOptimizedBlocks
          blocks={optimizedBlocksQuery.data?.items}
          totalBlocks={optimizedBlocksQuery.data?.total}
          runId={latestRunId}
          isLoading={optimizedBlocksQuery.isLoading && !optimizedBlocksQuery.data}
          isError={optimizedBlocksQuery.isError}
          errorMessage={optimizedBlocksQuery.error instanceof Error ? optimizedBlocksQuery.error.message : undefined}
          onRetry={() => optimizedBlocksQuery.refetch()}
        />
      )}
    </div>
  );
}
