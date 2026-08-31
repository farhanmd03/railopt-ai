"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, Clock, Flame, Wrench } from "lucide-react";

interface MaintenanceSummaryStripProps {
  totalTasks: number;
  criticalCount: number;
  highCount: number;
  overdueCount: number;
  openCount: number;
  isLoading?: boolean;
}

export function MaintenanceSummaryStrip({
  totalTasks,
  criticalCount,
  highCount,
  overdueCount,
  openCount,
  isLoading,
}: MaintenanceSummaryStripProps) {
  const metrics = [
    {
      title: "Total Work Orders",
      value: totalTasks,
      icon: Wrench,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950/40",
      border: "border-blue-200 dark:border-blue-900",
      description: "Active division defect backlog",
    },
    {
      title: "Critical Severity",
      value: criticalCount,
      icon: Flame,
      color: "text-red-600",
      bg: "bg-red-50 dark:bg-red-950/40",
      border: "border-red-200 dark:border-red-900",
      description: "Immediate safety / speed restriction",
    },
    {
      title: "High Severity",
      value: highCount,
      icon: AlertTriangle,
      color: "text-amber-600",
      bg: "bg-amber-50 dark:bg-amber-950/40",
      border: "border-amber-200 dark:border-amber-900",
      description: "Significant track/asset degradation",
    },
    {
      title: "Overdue Backlog",
      value: overdueCount,
      icon: Clock,
      color: "text-orange-600",
      bg: "bg-orange-50 dark:bg-orange-950/40",
      border: "border-orange-200 dark:border-orange-900",
      description: "Past target maintenance window",
    },
    {
      title: "Open / In Progress",
      value: openCount,
      icon: CheckCircle2,
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      border: "border-emerald-200 dark:border-emerald-900",
      description: "Pending possession scheduling",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {metrics.map((m) => {
        const Icon = m.icon;
        return (
          <Card key={m.title} className="border-border bg-card shadow-xs">
            <CardContent className="p-3.5">
              {isLoading ? (
                <div className="space-y-2">
                  <div className="h-3 w-20 bg-muted/60 animate-pulse rounded" />
                  <div className="h-6 w-12 bg-muted/60 animate-pulse rounded" />
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-muted-foreground truncate">
                      {m.title}
                    </span>
                    <div className={`p-1.5 rounded ${m.bg} ${m.border} border`}>
                      <Icon className={`h-3.5 w-3.5 ${m.color}`} />
                    </div>
                  </div>
                  <div className="text-xl font-extrabold text-foreground mt-1">
                    {m.value}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    {m.description}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
