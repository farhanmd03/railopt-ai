"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "react-oidc-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getOptimizationRun } from "@/lib/api/optimization";
import { getRunScenarios, createRunScenario, getScenarioDetail } from "@/lib/api/scenarios";
import { OptimizationScenario, ScenarioCreatePayload } from "@/lib/types/scenario";
import { extractRoles, hasAnyRole } from "@/lib/auth-config";
import { ScenarioForm } from "@/components/optimization/scenario-form";
import { ScenarioComparisonTable } from "@/components/optimization/scenario-comparison-table";
import { ScenarioTaskDiff } from "@/components/optimization/scenario-task-diff";
import { ScenarioBlockDiff } from "@/components/optimization/scenario-block-diff";
import { ScenarioHistory } from "@/components/optimization/scenario-history";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Sparkles,
  MapPin,
  Calendar,
  AlertCircle,
  ShieldCheck,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";

export default function WhatIfScenarioPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const auth = useAuth();
  const userRoles = extractRoles(auth.user);
  const canCreateScenario = hasAnyRole(userRoles, ["ADMIN", "PLANNER", "CONTROL"]);

  const rawRunId = params?.run_id as string;
  const runId = Array.isArray(rawRunId) ? rawRunId[0] : rawRunId;

  const [activeScenario, setActiveScenario] = useState<OptimizationScenario | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. Fetch base optimization run details
  const {
    data: baseRun,
    isLoading: isBaseRunLoading,
    error: baseRunError,
  } = useQuery({
    queryKey: ["optimization-run", runId],
    queryFn: () => getOptimizationRun(runId),
    enabled: !!runId,
  });

  // 2. Fetch scenario history for this base run
  const {
    data: scenarioHistory,
    isLoading: isHistoryLoading,
  } = useQuery({
    queryKey: ["run-scenarios", runId],
    queryFn: () => getRunScenarios(runId),
    enabled: !!runId,
  });

  // Automatically select the most recent scenario if available
  useEffect(() => {
    if (!activeScenario && scenarioHistory?.items && scenarioHistory.items.length > 0) {
      setActiveScenario(scenarioHistory.items[0]);
    }
  }, [scenarioHistory, activeScenario]);

  // 3. Create & Execute scenario mutation
  const runScenarioMutation = useMutation({
    mutationFn: (payload: ScenarioCreatePayload) => createRunScenario(runId, payload),
    onSuccess: (newScenario) => {
      setActiveScenario(newScenario);
      setErrorMessage(null);
      queryClient.invalidateQueries({ queryKey: ["run-scenarios", runId] });
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail || err?.message || "Failed to execute scenario solve.";
      setErrorMessage(detail);
    },
  });

  const handleSelectScenario = async (scen: OptimizationScenario) => {
    try {
      setErrorMessage(null);
      // Fetch full scenario detail with comparative data if needed
      const fullDetail = await getScenarioDetail(scen.scenario_id || scen.id);
      setActiveScenario(fullDetail);
    } catch (e: any) {
      setActiveScenario(scen);
    }
  };

  if (isBaseRunLoading) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-4 animate-pulse">
        <div className="h-8 bg-muted rounded w-1/3" />
        <div className="h-32 bg-muted rounded" />
        <div className="h-96 bg-muted rounded" />
      </div>
    );
  }

  if (baseRunError || !baseRun) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="p-6 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive space-y-3">
          <div className="flex items-center gap-2 font-bold text-sm">
            <AlertCircle className="h-5 w-5" />
            <span>Base Optimization Run Not Found</span>
          </div>
          <p className="text-xs">
            Unable to load base run #{runId}. It may have been deleted or the ID is invalid.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/optimization")}
            className="text-xs mt-2"
          >
            Back to Optimization Workbench
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Breadcrumb & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/optimization/runs/${runId}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Run Details</span>
          </Link>
          <span className="text-muted-foreground">•</span>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-600" />
            <h1 className="text-base sm:text-lg font-bold text-foreground">
              What-If Scenario Laboratory
            </h1>
          </div>
        </div>

        {/* Global Deep-Links */}
        <div className="flex items-center gap-2 flex-wrap">
          {activeScenario?.scenario_run_id && (
            <>
              <Link
                href={`/map?run=${activeScenario.scenario_run_id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border transition-colors shadow-2xs"
              >
                <MapPin className="h-3.5 w-3.5 text-blue-600" />
                <span>View Scenario on Map</span>
              </Link>
              <Link
                href={`/planning/calendar`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border transition-colors shadow-2xs"
              >
                <Calendar className="h-3.5 w-3.5 text-purple-600" />
                <span>Planning Timeline</span>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Base Run Read-Only Banner */}
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-foreground">
              {`BASE RUN #${baseRun.id}`}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {`(${baseRun.run_id})`}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
              BASE RUN — READ ONLY
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              APPROVAL: {baseRun.approval_status || "DRAFT"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Original objective score:{" "}
            <span className="font-mono font-semibold text-foreground">
              {baseRun.objective_value ? Number(baseRun.objective_value).toFixed(1) : "—"}
            </span>{" "}
            • Scheduled Tasks:{" "}
            <span className="font-mono font-semibold text-foreground">
              {baseRun.tasks_scheduled}
            </span>{" "}
            • Total Blocks:{" "}
            <span className="font-mono font-semibold text-foreground">
              {(baseRun.integrated_block_count || 0) + (baseRun.separate_block_count || 0)}
            </span>
          </p>
        </div>

        <div className="text-xs text-muted-foreground shrink-0 flex items-center gap-1.5 bg-muted/40 px-3 py-1.5 rounded border border-border/60">
          <ShieldCheck className="h-4 w-4 text-slate-700" />
          <span>Base run cannot be overwritten by scenarios</span>
        </div>
      </div>

      {/* Error Message Banner */}
      {errorMessage && (
        <div className="p-4 rounded-md border border-destructive/40 bg-destructive/10 text-destructive text-xs space-y-1">
          <div className="flex items-center gap-2 font-bold">
            <AlertCircle className="h-4 w-4" />
            <span>Scenario Execution Error</span>
          </div>
          <p>{errorMessage}</p>
        </div>
      )}

      {/* Grid: Scenario Form (Left / Top) & Comparison Results (Right / Bottom) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Scenario Configuration Form */}
        <div className="lg:col-span-5 space-y-6">
          <ScenarioForm
            baseRunId={baseRun.id}
            onSubmit={async (payload) => {
              await runScenarioMutation.mutateAsync(payload);
            }}
            isLoading={runScenarioMutation.isPending}
            canCreate={canCreateScenario}
          />

          {/* Scenario History */}
          <ScenarioHistory
            scenarios={scenarioHistory?.items || []}
            activeScenarioId={activeScenario?.scenario_id}
            onSelectScenario={handleSelectScenario}
            isLoading={runScenarioMutation.isPending}
          />
        </div>

        {/* Comparative Analysis Results */}
        <div className="lg:col-span-7 space-y-6">
          {activeScenario?.comparison ? (
            <>
              {/* Hero Comparison Table */}
              <ScenarioComparisonTable
                comparison={activeScenario.comparison}
                scenarioName={activeScenario.name}
                baseRunId={baseRun.id}
                scenarioRunId={activeScenario.scenario_run_id}
              />

              {/* Task Diff */}
              {activeScenario.task_impact && (
                <ScenarioTaskDiff taskImpact={activeScenario.task_impact} />
              )}

              {/* Block Diff */}
              {activeScenario.block_differences && (
                <ScenarioBlockDiff
                  blockDiff={activeScenario.block_differences}
                  scenarioRunId={activeScenario.scenario_run_id}
                />
              )}
            </>
          ) : activeScenario?.status === "INFEASIBLE" ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-6 text-center space-y-3">
              <div className="inline-flex p-3 rounded-full bg-amber-100 text-amber-800">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-amber-900">
                No Feasible Plan Found
              </h3>
              <p className="text-xs text-amber-800 max-w-md mx-auto">
                Under the specified scenario parameters, the mathematical optimizer could not satisfy all mandatory engineering constraints.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center space-y-3">
              <div className="inline-flex p-3 rounded-full bg-muted text-muted-foreground">
                <Sparkles className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-foreground">
                Ready to Run What-If Scenario
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Modify planning assumptions on the left and click &quot;Run What-If Scenario&quot; to compute exact mathematical deltas using Google OR-Tools CP-SAT.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
