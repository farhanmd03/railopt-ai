"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Layers, Shuffle, Sparkles, Train } from "lucide-react";

interface OpportunityOverviewStripProps {
  totalOpportunities: number;
  crossDeptCount: number;
  compatibleCount: number;
  totalCandidates: number;
  feasibleCandidatesCount: number;
  isLoading?: boolean;
}

export function OpportunityOverviewStrip({
  totalOpportunities,
  crossDeptCount,
  compatibleCount,
  totalCandidates,
  feasibleCandidatesCount,
  isLoading,
}: OpportunityOverviewStripProps) {
  const metrics = [
    {
      title: "Integration Opportunities",
      value: totalOpportunities,
      icon: Layers,
      color: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-950/40",
      border: "border-purple-200 dark:border-purple-900",
      description: "Screened section co-locations",
    },
    {
      title: "Cross-Department",
      value: crossDeptCount,
      icon: Shuffle,
      color: "text-indigo-600",
      bg: "bg-indigo-50 dark:bg-indigo-950/40",
      border: "border-indigo-200 dark:border-indigo-900",
      description: "Multi-discipline joint blocks",
    },
    {
      title: "Fully Compatible",
      value: compatibleCount,
      icon: CheckCircle2,
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      border: "border-emerald-200 dark:border-emerald-900",
      description: "100% spatial/temporal alignment",
    },
    {
      title: "Candidate Blocks",
      value: totalCandidates.toLocaleString(),
      icon: Train,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950/40",
      border: "border-blue-200 dark:border-blue-900",
      description: "Evaluated possession options",
    },
    {
      title: "Feasible Block Options",
      value: feasibleCandidatesCount.toLocaleString(),
      icon: Sparkles,
      color: "text-teal-600",
      bg: "bg-teal-50 dark:bg-teal-950/40",
      border: "border-teal-200 dark:border-teal-900",
      description: "Zero timetable conflict",
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
                  <div className="h-3 w-24 bg-muted/60 animate-pulse rounded" />
                  <div className="h-6 w-14 bg-muted/60 animate-pulse rounded" />
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
