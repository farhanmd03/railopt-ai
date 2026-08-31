"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SeverityBadge } from "@/components/status/severity-badge";
import { MaintenanceTask } from "@/lib/types/maintenance";
import { AlertCircle, BarChart3, Info } from "lucide-react";

interface PriorityDistributionProps {
  tasks: MaintenanceTask[];
  isLoading?: boolean;
}

export function PriorityDistribution({ tasks, isLoading }: PriorityDistributionProps) {
  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Priority & Severity Distribution</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-32 bg-muted/40 animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  const total = tasks.length;
  const critical = tasks.filter((t) => t.severity === "Critical").length;
  const high = tasks.filter((t) => t.severity === "High").length;
  const medium = tasks.filter((t) => t.severity === "Medium").length;
  const low = tasks.filter((t) => t.severity === "Low").length;

  const validScores = tasks
    .map((t) => t.priority_score)
    .filter((s): s is number => s != null && !isNaN(s));
  const avgScore =
    validScores.length > 0
      ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(2)
      : "—";
  const maxScore =
    validScores.length > 0 ? Math.max(...validScores).toFixed(2) : "—";

  const bands = [
    {
      label: "Critical",
      count: critical,
      percent: total > 0 ? (critical / total) * 100 : 0,
      color: "bg-red-600",
      textColor: "text-red-700 dark:text-red-400",
      bgSubtle: "bg-red-50 dark:bg-red-950/40",
      borderColor: "border-red-200 dark:border-red-900",
      description: "Immediate safety / track speed restriction risk",
    },
    {
      label: "High",
      count: high,
      percent: total > 0 ? (high / total) * 100 : 0,
      color: "bg-amber-500",
      textColor: "text-amber-700 dark:text-amber-400",
      bgSubtle: "bg-amber-50 dark:bg-amber-950/40",
      borderColor: "border-amber-200 dark:border-amber-900",
      description: "Significant degradation requiring priority slot",
    },
    {
      label: "Medium",
      count: medium,
      percent: total > 0 ? (medium / total) * 100 : 0,
      color: "bg-blue-500",
      textColor: "text-blue-700 dark:text-blue-400",
      bgSubtle: "bg-blue-50 dark:bg-blue-950/40",
      borderColor: "border-blue-200 dark:border-blue-900",
      description: "Standard scheduled maintenance defect",
    },
    {
      label: "Low",
      count: low,
      percent: total > 0 ? (low / total) * 100 : 0,
      color: "bg-slate-400",
      textColor: "text-slate-700 dark:text-slate-400",
      bgSubtle: "bg-slate-50 dark:bg-slate-900/40",
      borderColor: "border-slate-200 dark:border-slate-800",
      description: "Routine inspection / minor non-disruptive task",
    },
  ];

  return (
    <Card className="h-full flex flex-col justify-between border-border bg-card shadow-xs">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-foreground">
            <BarChart3 className="h-4 w-4 text-blue-600" />
            <span>Defect Severity & Priority Distribution</span>
          </CardTitle>
          <span className="text-xs font-semibold text-muted-foreground">
            {total} Total Tasks
          </span>
        </div>
        <CardDescription className="text-xs text-muted-foreground">
          Priority score distribution across Howrah Division assets.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 pt-1">
        {/* Visual Stacked Progress Bar */}
        <div className="space-y-1.5">
          <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 flex overflow-hidden border border-border">
            {bands.map((band) =>
              band.count > 0 ? (
                <div
                  key={band.label}
                  style={{ width: `${band.percent}%` }}
                  className={`${band.color} transition-all duration-300`}
                  title={`${band.label}: ${band.count} (${band.percent.toFixed(1)}%)`}
                />
              ) : null
            )}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Critical & High: {((critical + high) / (total || 1) * 100).toFixed(1)}%</span>
            <span>Medium & Low: {((medium + low) / (total || 1) * 100).toFixed(1)}%</span>
          </div>
        </div>

        {/* Severity Band Details */}
        <div className="grid grid-cols-2 gap-2">
          {bands.map((band) => (
            <div
              key={band.label}
              className={`p-2.5 rounded border ${band.borderColor} ${band.bgSubtle} flex flex-col justify-between`}
            >
              <div className="flex items-center justify-between">
                <SeverityBadge severity={band.label} />
                <span className={`text-sm font-extrabold ${band.textColor}`}>
                  {band.count}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">
                {band.description}
              </p>
            </div>
          ))}
        </div>

        {/* Priority Metrics Banner */}
        <div className="flex items-center justify-between bg-muted/50 p-2.5 rounded border border-border text-xs">
          <div className="space-y-0.5">
            <span className="text-[11px] font-semibold text-foreground">
              Division Priority Metrics
            </span>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span>Avg Score: <strong className="text-foreground">{avgScore}</strong></span>
              <span>Max Score: <strong className="text-foreground">{maxScore}</strong></span>
            </div>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Info className="h-3 w-3" />
            <span>Baseline Priority</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
