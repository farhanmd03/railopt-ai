"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "react-oidc-context";
import { buildAuthUser } from "@/lib/auth-config";
import * as optimizationApi from "@/lib/api/optimization";
import { OptimizationRun, OptimizationRunCreateRequest } from "@/lib/types/optimization";

import { OptimizationHeader } from "@/components/optimization/optimization-header";
import {
  OptimizationConfig,
  PlannerConfigState,
  DEFAULT_PLANNER_CONFIG,
} from "@/components/optimization/optimization-config";
import { SolverLoadingState } from "@/components/optimization/solver-loading-state";
import { OptimizationResultView } from "@/components/optimization/optimization-result-view";
import { OptimizationHistory } from "@/components/optimization/optimization-history";
import { AlertCircle } from "lucide-react";

export default function OptimizationPage() {
  const auth = useAuth();
  const user = buildAuthUser(auth.user);
  const queryClient = useQueryClient();

  const [config, setConfig] = useState<PlannerConfigState>(DEFAULT_PLANNER_CONFIG);
  const [activeRun, setActiveRun] = useState<OptimizationRun | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canGenerate =
    user?.roles.includes("PLANNER") ||
    user?.roles.includes("ADMIN") ||
    user?.roles.includes("CONTROL");

  // 1. Historical runs query
  const historyQuery = useQuery({
    queryKey: ["optimization-runs"],
    queryFn: () => optimizationApi.getOptimizationRuns({ page: 1, page_size: 20 }),
  });

  const historicalRuns = historyQuery.data?.items || [];

  // Default active run to the latest historical run if not already set
  React.useEffect(() => {
    if (!activeRun && historicalRuns.length > 0) {
      setActiveRun(historicalRuns[0]);
    }
  }, [historicalRuns, activeRun]);

  // 2. Generate run mutation
  const generateMutation = useMutation({
    mutationFn: (requestPayload: OptimizationRunCreateRequest) =>
      optimizationApi.createOptimizationRun(requestPayload),
    onMutate: () => {
      setErrorMessage(null);
    },
    onSuccess: (newRun) => {
      setActiveRun(newRun);
      queryClient.invalidateQueries({ queryKey: ["optimization-runs"] });
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while executing the solver.";
      setErrorMessage(msg);
    },
  });

  const handleGenerate = () => {
    if (!canGenerate) return;

    const payload: OptimizationRunCreateRequest = {
      planning_start: config.planningStart,
      planning_end: config.planningEnd,
      solver_time_limit_seconds: config.solverTimeLimitSeconds,
      weight_priority_score: config.weightPriorityScore,
      weight_integrated_task_bonus: config.weightIntegratedTaskBonus,
      weight_tasks_scheduled: config.weightTasksScheduled,
      weight_overdue_mitigation: config.weightOverdueMitigation,
      weight_train_disruption: config.weightTrainDisruption,
      weight_freight_impact: config.weightFreightImpact,
      weight_unused_window_time: config.weightUnusedWindowTime,
      weight_total_block_count: config.weightTotalBlockCount,
      run_type: "standard",
    };

    generateMutation.mutate(payload);
  };

  const handleRefresh = async () => {
    await historyQuery.refetch();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Header */}
      <OptimizationHeader
        user={user}
        isRefreshing={historyQuery.isFetching}
        onRefresh={handleRefresh}
      />

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-3.5 rounded border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/30 text-xs text-red-900 dark:text-red-300 flex items-start gap-2 animate-in fade-in">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold block">Optimization Request Failed</span>
            <span className="text-[11px]">{errorMessage}</span>
          </div>
        </div>
      )}

      {/* 2. Configuration & Parameter Console */}
      <OptimizationConfig
        config={config}
        onChange={setConfig}
        onGenerate={handleGenerate}
        isGenerating={generateMutation.isPending}
        canGenerate={canGenerate}
      />

      {/* 3. Solver Running State */}
      {generateMutation.isPending && (
        <SolverLoadingState
          planningStart={config.planningStart}
          planningEnd={config.planningEnd}
        />
      )}

      {/* 4. Active Optimization Run Results View */}
      {activeRun && !generateMutation.isPending && (
        <OptimizationResultView run={activeRun} />
      )}

      {/* 5. Historical Optimization Runs */}
      <OptimizationHistory
        runs={historicalRuns}
        selectedRunId={activeRun?.id || null}
        onSelectRun={(run) => setActiveRun(run)}
        isLoading={historyQuery.isLoading && !historyQuery.data}
        isError={historyQuery.isError}
        onRetry={() => historyQuery.refetch()}
      />
    </div>
  );
}
