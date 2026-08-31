"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OptimizationScenario } from "@/lib/types/scenario";
import { History, ArrowRight, CheckCircle2, AlertCircle, Clock } from "lucide-react";

interface ScenarioHistoryProps {
  scenarios: OptimizationScenario[];
  activeScenarioId?: string | number | null;
  onSelectScenario: (scenario: OptimizationScenario) => void;
  isLoading?: boolean;
}

export function ScenarioHistory({
  scenarios,
  activeScenarioId,
  onSelectScenario,
  isLoading,
}: ScenarioHistoryProps) {
  if (!scenarios || scenarios.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-bold text-foreground">
              Scenario History for Base Run
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4 text-center text-xs text-muted-foreground">
          No previous What-If scenarios executed for this base run yet.
        </CardContent>
      </Card>
    );
  }

  const formatDateTime = (isoString?: string | null) => {
    if (!isoString) return "—";
    try {
      const d = new Date(isoString);
      return d.toLocaleString("en-IN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } catch {
      return isoString;
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-blue-600" />
            <CardTitle className="text-sm font-bold text-foreground">
              Scenario History ({scenarios.length})
            </CardTitle>
          </div>
          <span className="text-[11px] text-muted-foreground">
            Select to compare
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/40 font-semibold text-muted-foreground uppercase tracking-wider">
              <th className="py-2.5 px-3">Scenario</th>
              <th className="py-2.5 px-3">Type</th>
              <th className="py-2.5 px-3">Created</th>
              <th className="py-2.5 px-3">Solver</th>
              <th className="py-2.5 px-3 text-right">Tasks</th>
              <th className="py-2.5 px-3 text-right">Blocks</th>
              <th className="py-2.5 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {scenarios.map((scen) => {
              const isSelected =
                activeScenarioId === scen.scenario_id ||
                activeScenarioId === String(scen.id);
              const isCompleted = scen.status === "COMPLETED";

              const tasks = scen.comparison?.tasks_scheduled?.scenario ?? scen.scenario_run?.tasks_scheduled ?? "—";
              const blocks = scen.comparison?.block_count?.scenario ?? (scen.scenario_run ? (scen.scenario_run.integrated_block_count + scen.scenario_run.separate_block_count) : "—");

              return (
                <tr
                  key={scen.id || scen.scenario_id}
                  className={`transition-colors hover:bg-muted/30 ${
                    isSelected ? "bg-blue-50/60 dark:bg-blue-950/20 font-medium" : ""
                  }`}
                >
                  <td className="py-2.5 px-3">
                    <div>
                      <span className="font-semibold text-foreground">{scen.name}</span>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {scen.scenario_id}
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
                      {scen.scenario_type}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-muted-foreground">
                    {formatDateTime(scen.created_at)}
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold border ${
                        isCompleted
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : scen.status === "INFEASIBLE"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-slate-50 text-slate-700 border-slate-200"
                      }`}
                    >
                      {isCompleted ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                      {scen.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-foreground font-semibold">
                    {tasks}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-foreground font-semibold">
                    {blocks}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <Button
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => onSelectScenario(scen)}
                      disabled={isLoading}
                      className="h-6 text-[11px] px-2.5 gap-1"
                    >
                      <span>{isSelected ? "Active" : "Inspect"}</span>
                      {!isSelected && <ArrowRight className="h-3 w-3" />}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
