"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { OptimizationRun } from "@/lib/types/optimization";
import {
  AlertTriangle,
  Calendar,
  Cpu,
  Layers,
  ShieldCheck,
  Wrench,
} from "lucide-react";

interface KpiOverviewProps {
  totalTasks?: number;
  criticalTasks?: number;
  highTasks?: number;
  integrationOpportunities?: number;
  candidateBlocks?: number;
  latestRun?: OptimizationRun | null;
  isLoading?: boolean;
}

export function KpiOverview({
  totalTasks,
  criticalTasks = 0,
  highTasks = 0,
  integrationOpportunities,
  candidateBlocks,
  latestRun,
  isLoading,
}: KpiOverviewProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="p-3.5 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-2.5 w-full" />
          </Card>
        ))}
      </div>
    );
  }

  const criticalAndHigh = criticalTasks + highTasks;
  const schedulingRate =
    latestRun && latestRun.tasks_considered > 0
      ? ((latestRun.tasks_scheduled / latestRun.tasks_considered) * 100).toFixed(1)
      : null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {/* 1. Total Maintenance Tasks */}
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between pb-1.5 p-3.5">
          <CardTitle className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Total Tasks
          </CardTitle>
          <Wrench className="h-3.5 w-3.5 text-blue-600" />
        </CardHeader>
        <CardContent className="p-3.5 pt-0">
          <div className="text-2xl font-extrabold text-foreground tracking-tight">
            {totalTasks != null ? totalTasks.toLocaleString() : "—"}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            Active work orders in HWH
          </p>
        </CardContent>
      </Card>

      {/* 2. Critical & High Tasks */}
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between pb-1.5 p-3.5">
          <CardTitle className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Critical & High
          </CardTitle>
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
        </CardHeader>
        <CardContent className="p-3.5 pt-0">
          <div className="text-2xl font-extrabold text-foreground tracking-tight flex items-baseline gap-1.5">
            <span>{criticalAndHigh.toLocaleString()}</span>
            {criticalTasks > 0 && (
              <span className="text-[10px] font-bold text-red-600 bg-red-50 dark:bg-red-950/60 px-1 py-0.2 rounded border border-red-200 dark:border-red-900">
                {criticalTasks} Crit
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {highTasks} High severity defects
          </p>
        </CardContent>
      </Card>

      {/* 3. Integration Opportunities */}
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between pb-1.5 p-3.5">
          <CardTitle className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Opportunities
          </CardTitle>
          <Layers className="h-3.5 w-3.5 text-emerald-600" />
        </CardHeader>
        <CardContent className="p-3.5 pt-0">
          <div className="text-2xl font-extrabold text-foreground tracking-tight">
            {integrationOpportunities != null
              ? integrationOpportunities.toLocaleString()
              : "—"}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            Cross-dept combinations
          </p>
        </CardContent>
      </Card>

      {/* 4. Candidate Blocks */}
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between pb-1.5 p-3.5">
          <CardTitle className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Candidate Blocks
          </CardTitle>
          <Calendar className="h-3.5 w-3.5 text-purple-600" />
        </CardHeader>
        <CardContent className="p-3.5 pt-0">
          <div className="text-2xl font-extrabold text-foreground tracking-tight">
            {candidateBlocks != null ? candidateBlocks.toLocaleString() : "—"}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            Corridor-aligned slots
          </p>
        </CardContent>
      </Card>

      {/* 5. Latest Tasks Scheduled */}
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between pb-1.5 p-3.5">
          <CardTitle className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Tasks Scheduled
          </CardTitle>
          <Cpu className="h-3.5 w-3.5 text-blue-600" />
        </CardHeader>
        <CardContent className="p-3.5 pt-0">
          <div className="text-2xl font-extrabold text-foreground tracking-tight">
            {latestRun != null ? (
              <span>
                {latestRun.tasks_scheduled}
                <span className="text-xs font-normal text-muted-foreground">
                  /{latestRun.tasks_considered}
                </span>
              </span>
            ) : (
              "—"
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {schedulingRate ? `${schedulingRate}% assignment rate` : "No active plan"}
          </p>
        </CardContent>
      </Card>

      {/* 6. Integrated Possessions */}
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between pb-1.5 p-3.5">
          <CardTitle className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Integrated Blocks
          </CardTitle>
          <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
        </CardHeader>
        <CardContent className="p-3.5 pt-0">
          <div className="text-2xl font-extrabold text-foreground tracking-tight">
            {latestRun != null ? latestRun.integrated_block_count.toLocaleString() : "—"}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {latestRun != null
              ? `${latestRun.separate_block_count} separate blocks`
              : "No active plan"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
