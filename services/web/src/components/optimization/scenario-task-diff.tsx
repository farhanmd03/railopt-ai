"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScenarioTaskImpact } from "@/lib/types/scenario";
import { CheckCircle2, AlertCircle, RefreshCw, Layers, ExternalLink } from "lucide-react";

interface ScenarioTaskDiffProps {
  taskImpact: ScenarioTaskImpact;
}

export function ScenarioTaskDiff({ taskImpact }: ScenarioTaskDiffProps) {
  const [activeTab, setActiveTab] = useState<"newly_unassigned" | "newly_scheduled" | "retained" | "changed_block">(
    taskImpact.newly_unassigned_task_ids.length > 0
      ? "newly_unassigned"
      : taskImpact.newly_scheduled_task_ids.length > 0
      ? "newly_scheduled"
      : "retained"
  );

  const tabs = [
    {
      id: "newly_unassigned" as const,
      label: "Newly Unassigned",
      count: taskImpact.newly_unassigned_task_ids.length,
      icon: AlertCircle,
      badgeColor: "bg-amber-100 text-amber-800 border-amber-300",
      description: "Tasks that were scheduled in the Base Run but dropped in this scenario.",
      items: taskImpact.newly_unassigned_task_ids,
    },
    {
      id: "newly_scheduled" as const,
      label: "Newly Scheduled",
      count: taskImpact.newly_scheduled_task_ids.length,
      icon: CheckCircle2,
      badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300",
      description: "Tasks that were unassigned in the Base Run but successfully scheduled in this scenario.",
      items: taskImpact.newly_scheduled_task_ids,
    },
    {
      id: "changed_block" as const,
      label: "Changed Block / Time",
      count: taskImpact.changed_block_task_ids.length,
      icon: RefreshCw,
      badgeColor: "bg-blue-100 text-blue-800 border-blue-300",
      description: "Tasks scheduled in both runs, but shifted to a different section, corridor block, or start window.",
      items: taskImpact.changed_block_task_ids,
    },
    {
      id: "retained" as const,
      label: "Retained Tasks",
      count: taskImpact.retained_task_ids.length,
      icon: Layers,
      badgeColor: "bg-slate-100 text-slate-800 border-slate-300",
      description: "Tasks consistently scheduled across both the Base Run and this scenario.",
      items: taskImpact.retained_task_ids,
    },
  ];

  const currentTabData = tabs.find((t) => t.id === activeTab) || tabs[0];

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3 border-b border-border/50">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="text-base font-bold text-foreground">
              Task-Level Impact Analysis
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Granular breakdown of individual maintenance work orders affected by this scenario
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {/* Tab Selection */}
        <div className="flex flex-wrap gap-2 border-b border-border pb-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                type="button"
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all border ${
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
                <span
                  className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-foreground"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tab Context Description */}
        <div className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded border border-border/60">
          {currentTabData.description}
        </div>

        {/* Task Grid */}
        {currentTabData.items.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 pt-1">
            {currentTabData.items.map((taskId) => (
              <Link
                key={taskId}
                href={`/maintenance?search=${encodeURIComponent(taskId)}`}
                className="group flex items-center justify-between p-2 rounded-md border border-border bg-card hover:border-primary/50 hover:bg-muted/30 transition-colors shadow-2xs"
                title={`Inspect task ${taskId} in Maintenance Workbench`}
              >
                <span className="font-mono text-xs font-semibold text-foreground group-hover:text-primary">
                  {taskId}
                </span>
                <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No tasks in this category for the current scenario.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
