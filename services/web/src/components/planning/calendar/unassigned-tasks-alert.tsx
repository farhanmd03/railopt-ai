"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronDown, ChevronUp, ExternalLink, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UnassignedTasksAlertProps {
  unassignedCount: number;
  unassignedTaskIds: string[];
}

export function UnassignedTasksAlert({
  unassignedCount,
  unassignedTaskIds,
}: UnassignedTasksAlertProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (unassignedCount <= 0) return null;

  return (
    <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded p-3 text-xs shadow-xs space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <span className="font-bold text-amber-900 dark:text-amber-200">
              {unassignedCount} Maintenance {unassignedCount === 1 ? "Task was" : "Tasks were"} not assigned by the solver
            </span>
            <span className="text-amber-800/80 dark:text-amber-300/80 ml-1.5 hidden sm:inline">
              under current planning horizon and exclusivity constraints.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {unassignedTaskIds.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-7 px-2 text-xs text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50"
            >
              <span>{isExpanded ? "Hide Task List" : "Show Task List"}</span>
              {isExpanded ? (
                <ChevronUp className="h-3.5 w-3.5 ml-1" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 ml-1" />
              )}
            </Button>
          )}

          <Link
            href="/maintenance"
            className="inline-flex items-center gap-1 bg-amber-700 hover:bg-amber-800 text-white dark:bg-amber-600 dark:hover:bg-amber-700 px-2.5 py-1 rounded font-semibold transition-colors shadow-xs"
          >
            <Wrench className="h-3 w-3" />
            <span>Open Maintenance Workbench</span>
            <ExternalLink className="h-3 w-3 ml-0.5" />
          </Link>
        </div>
      </div>

      {isExpanded && unassignedTaskIds.length > 0 && (
        <div className="pt-2 border-t border-amber-200 dark:border-amber-800 space-y-1.5 animate-in fade-in duration-150">
          <p className="text-[11px] text-amber-900/80 dark:text-amber-300/80 font-medium">
            The following work orders could not be accommodated into candidate possession windows within this solver run:
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {unassignedTaskIds.map((taskId) => (
              <Link
                key={taskId}
                href="/maintenance"
                className="inline-flex items-center gap-1 font-mono text-[11px] font-bold bg-background px-2 py-0.5 rounded border border-border hover:border-amber-500 text-foreground transition-colors group"
                title={`Inspect ${taskId} in Maintenance Workbench`}
              >
                <span>{taskId}</span>
                <ExternalLink className="h-2.5 w-2.5 text-muted-foreground group-hover:text-amber-600" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
