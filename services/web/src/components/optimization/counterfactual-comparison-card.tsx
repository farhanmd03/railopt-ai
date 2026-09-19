"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CounterfactualComparison } from "@/lib/types/scenario";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ShieldCheck,
  Zap,
} from "lucide-react";

interface CounterfactualComparisonCardProps {
  comparison: CounterfactualComparison;
  scenarioName: string;
}

export function CounterfactualComparisonCard({
  comparison,
  scenarioName,
}: CounterfactualComparisonCardProps) {
  const { baseline, alternative, deltas, rating, explanation } = comparison;

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleString("en-IN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "UTC",
      }) + " UTC";
    } catch {
      return isoStr;
    }
  };

  const getRatingBadge = (r: string) => {
    const val = (r || "").toUpperCase();
    if (val === "BETTER") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-700" />
          BETTER ALTERNATIVE
        </span>
      );
    }
    if (val === "WORSE") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
          <TrendingDown className="h-3.5 w-3.5 text-rose-700" />
          WORSE ALTERNATIVE
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300">
        <Minus className="h-3.5 w-3.5 text-slate-700" />
        NEUTRAL TRADEOFF
      </span>
    );
  };

  const getReadinessBadge = (status?: string) => {
    const s = (status || "").toUpperCase();
    if (s === "GO") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
          GO
        </span>
      );
    }
    if (s === "HOLD") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
          <HelpCircle className="h-3 w-3 text-amber-600" />
          HOLD
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
        <XCircle className="h-3 w-3 text-rose-600" />
        REDUCE
      </span>
    );
  };

  const rows = [
    {
      label: "Possession Window",
      base: `${formatDate(baseline.block_start)} → ${formatDate(baseline.block_end)}`,
      alt: `${formatDate(alternative.block_start)} → ${formatDate(alternative.block_end)}`,
      delta:
        deltas.duration_delta === 0
          ? "Shifted in time"
          : `${deltas.duration_delta > 0 ? "+" : ""}${deltas.duration_delta.toFixed(2)}h`,
      positiveIsGood: false,
    },
    {
      label: "Block Duration",
      base: `${baseline.duration_hrs.toFixed(2)} hrs`,
      alt: `${alternative.duration_hrs.toFixed(2)} hrs`,
      delta: `${deltas.duration_delta > 0 ? "+" : ""}${deltas.duration_delta.toFixed(2)}h`,
      positiveIsGood: false,
      isNumeric: true,
      numDelta: deltas.duration_delta,
    },
    {
      label: "Scheduled Tasks Count",
      base: `${baseline.task_ids.length} tasks`,
      alt: `${alternative.task_ids.length} tasks`,
      delta: `${alternative.task_ids.length - baseline.task_ids.length > 0 ? "+" : ""}${alternative.task_ids.length - baseline.task_ids.length} tasks`,
      positiveIsGood: true,
      isNumeric: true,
      numDelta: alternative.task_ids.length - baseline.task_ids.length,
    },
    {
      label: "Participating Departments",
      base: baseline.departments.join(", ") || "None",
      alt: alternative.departments.join(", ") || "None",
      delta: alternative.is_integrated ? "Integrated Joint Block" : "Single Department",
      positiveIsGood: true,
    },
    {
      label: "Delivered Priority Score",
      base: baseline.priority_score.toFixed(1),
      alt: alternative.priority_score.toFixed(1),
      delta: `${deltas.priority_delta > 0 ? "+" : ""}${deltas.priority_delta.toFixed(1)} pts`,
      positiveIsGood: true,
      isNumeric: true,
      numDelta: deltas.priority_delta,
    },
    {
      label: "Train Timetable Conflicts",
      base: `${baseline.train_conflicts} conflict(s)`,
      alt: `${alternative.train_conflicts} conflict(s)`,
      delta: `${deltas.train_conflicts_delta > 0 ? "+" : ""}${deltas.train_conflicts_delta}`,
      positiveIsGood: false,
      isNumeric: true,
      numDelta: deltas.train_conflicts_delta,
    },
    {
      label: "Operational / Impact Score",
      base: baseline.estimated_impact_score.toFixed(1),
      alt: alternative.estimated_impact_score.toFixed(1),
      delta: `${deltas.estimated_impact_delta > 0 ? "+" : ""}${deltas.estimated_impact_delta.toFixed(1)} pts`,
      positiveIsGood: true,
      isNumeric: true,
      numDelta: deltas.estimated_impact_delta,
    },
    {
      label: "Possession Readiness Gate",
      base: baseline.readiness?.readiness || "HOLD",
      alt: alternative.readiness?.readiness || "HOLD",
      delta: deltas.readiness_change || "UNCHANGED",
      positiveIsGood: true,
      isReadiness: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Narrative Explanation Banner */}
      <div className="rounded-lg border border-blue-200 bg-blue-50/80 p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm">
              <Info className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900">
                  Counterfactual Alternative Impact Analysis
                </h4>
                {getRatingBadge(rating)}
              </div>
              <p className="mt-1.5 text-xs sm:text-sm font-medium leading-relaxed text-blue-950">
                {explanation}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Baseline vs Alternative Comparison Table */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold text-foreground">
                Baseline Block vs Alternative Scenario Comparison
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Comparing target block{" "}
                <span className="font-mono font-semibold text-foreground">
                  {baseline.optimized_block_id || `OPT-BLK-${baseline.block_id}`}
                </span>{" "}
                against simulated scenario: {scenarioName}
              </p>
            </div>
            <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200">
              DECISION SUPPORT ONLY
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="py-3 px-4">Evaluation Dimension</th>
                <th className="py-3 px-4">Baseline (Original)</th>
                <th className="py-3 px-4">Alternative (What-If)</th>
                <th className="py-3 px-4 text-right">Net Impact (Delta)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.map((row) => {
                let badgeColor = "bg-muted text-muted-foreground border-border";
                let Icon = Minus;

                if (row.isNumeric && row.numDelta !== undefined) {
                  const isZero = Math.abs(row.numDelta) < 0.001;
                  const isPositive = row.numDelta > 0;
                  const isBeneficial = row.positiveIsGood ? isPositive : !isPositive;

                  if (!isZero) {
                    if (isBeneficial) {
                      badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold";
                      Icon = TrendingUp;
                    } else {
                      badgeColor = "bg-rose-50 text-rose-700 border-rose-200 font-semibold";
                      Icon = TrendingDown;
                    }
                  }
                } else if (row.isReadiness) {
                  if (row.delta === "IMPROVED") {
                    badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold";
                    Icon = TrendingUp;
                  } else if (row.delta === "DEGRADED") {
                    badgeColor = "bg-rose-50 text-rose-700 border-rose-200 font-semibold";
                    Icon = TrendingDown;
                  }
                }

                return (
                  <tr key={row.label} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 font-semibold text-foreground">
                      {row.label}
                    </td>
                    <td className="py-3 px-4 font-mono text-muted-foreground">
                      {row.isReadiness ? getReadinessBadge(row.base) : row.base}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-foreground">
                      {row.isReadiness ? getReadinessBadge(row.alt) : row.alt}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${badgeColor}`}
                      >
                        <Icon className="h-3 w-3" />
                        <span>{row.delta}</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Readiness Check Breakdown */}
      {alternative.readiness?.checks && alternative.readiness.checks.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                <CardTitle className="text-sm font-bold text-foreground">
                  Alternative Possession Readiness Checks
                </CardTitle>
              </div>
              {getReadinessBadge(alternative.readiness.readiness)}
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {alternative.readiness.checks.map((chk) => (
                <div
                  key={chk.key}
                  className={`p-2.5 rounded border text-xs flex items-start gap-2 ${
                    chk.status === "PASS"
                      ? "bg-emerald-50/50 border-emerald-200 text-emerald-950"
                      : chk.status === "PENDING"
                      ? "bg-amber-50/50 border-amber-200 text-amber-950"
                      : "bg-rose-50/50 border-rose-200 text-rose-950"
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {chk.status === "PASS" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : chk.status === "PENDING" ? (
                      <HelpCircle className="h-4 w-4 text-amber-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-rose-600" />
                    )}
                  </div>
                  <div>
                    <span className="font-bold block">{chk.label}</span>
                    <span className="text-[11px] text-muted-foreground mt-0.5 block leading-snug">
                      {chk.message}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground pt-1 italic">
              *Readiness evaluation is decision-support only. Final authority requires human approval.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
