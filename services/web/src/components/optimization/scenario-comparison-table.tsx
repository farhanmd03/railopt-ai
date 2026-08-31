"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScenarioComparisonSummary } from "@/lib/types/scenario";
import { TrendingUp, TrendingDown, Minus, Info, Sparkles } from "lucide-react";

interface ScenarioComparisonTableProps {
  comparison: ScenarioComparisonSummary;
  scenarioName: string;
  baseRunId: string | number;
  scenarioRunId?: string | number | null;
}

export function ScenarioComparisonTable({
  comparison,
  scenarioName,
  baseRunId,
  scenarioRunId,
}: ScenarioComparisonTableProps) {
  const rows = [
    {
      label: "Tasks Scheduled",
      data: comparison.tasks_scheduled,
      unit: "tasks",
      positiveIsGood: true,
      format: (v: number) => Math.round(v).toLocaleString(),
    },
    {
      label: "Tasks Unassigned",
      data: comparison.tasks_unassigned,
      unit: "tasks",
      positiveIsGood: false,
      format: (v: number) => Math.round(v).toLocaleString(),
    },
    {
      label: "Total Maintenance Blocks",
      data: comparison.block_count,
      unit: "blocks",
      positiveIsGood: false, // Fewer blocks usually means better consolidation
      format: (v: number) => Math.round(v).toLocaleString(),
    },
    {
      label: "Integrated Blocks (Cross-Dept)",
      data: comparison.integrated_blocks,
      unit: "blocks",
      positiveIsGood: true,
      format: (v: number) => Math.round(v).toLocaleString(),
    },
    {
      label: "Estimated Total Block Hours",
      data: comparison.estimated_total_block_hours,
      unit: "hrs",
      positiveIsGood: false, // Less track possession time is usually preferred
      format: (v: number) => v.toFixed(2),
    },
    {
      label: "Objective Score",
      data: comparison.objective_value,
      unit: "pts",
      positiveIsGood: true, // Higher objective score is mathematically better
      format: (v: number) => v.toFixed(1),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Hero Narrative Explanation */}
      <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm">
            <Info className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900">
              Deterministic Scenario Impact Assessment
            </h4>
            <p className="mt-1 text-sm font-medium leading-relaxed text-blue-950">
              {comparison.explanation}
            </p>
          </div>
        </div>
      </div>

      {/* Comparison KPI Table */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold text-foreground">
                Original vs Scenario Optimization Comparison
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Comparing Base Run #{baseRunId} against Experimental Scenario: {scenarioName}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-secondary text-secondary-foreground border border-border">
                Base Run: #{baseRunId}
              </span>
              {scenarioRunId && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                  Scenario Run: #{scenarioRunId}
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="py-3 px-4">Optimization Metric</th>
                <th className="py-3 px-4 text-right">Original (Base)</th>
                <th className="py-3 px-4 text-right">Scenario Result</th>
                <th className="py-3 px-4 text-right">Net Change (Delta)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.map((row) => {
                const delta = row.data.delta;
                const isZero = Math.abs(delta) < 0.001;
                const isPositive = delta > 0;
                const isBeneficial = row.positiveIsGood ? isPositive : !isPositive;

                let deltaColor = "text-muted-foreground";
                let badgeBg = "bg-muted text-muted-foreground";
                let Icon = Minus;

                if (!isZero) {
                  if (isBeneficial) {
                    deltaColor = "text-emerald-700 font-semibold";
                    badgeBg = "bg-emerald-50 text-emerald-700 border-emerald-200";
                    Icon = TrendingUp;
                  } else {
                    deltaColor = "text-amber-700 font-semibold";
                    badgeBg = "bg-amber-50 text-amber-700 border-amber-200";
                    Icon = TrendingDown;
                  }
                }

                return (
                  <tr key={row.label} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-foreground">
                      {row.label}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-medium text-muted-foreground">
                      {row.format(row.data.original)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-foreground">
                      {row.format(row.data.scenario)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono border ${badgeBg}`}
                      >
                        <Icon className="h-3 w-3" />
                        {isZero ? "0.0" : (delta > 0 ? `+${row.format(delta)}` : row.format(delta))}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
