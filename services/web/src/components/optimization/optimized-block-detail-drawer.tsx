"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { OptimizedBlock } from "@/lib/types/optimization";
import { formatDateTime, formatDuration, formatScore } from "@/lib/utils";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Layers,
  MapPin,
  Package,
  Shield,
  Sparkles,
  Train,
  Wrench,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface OptimizedBlockDetailDrawerProps {
  block: OptimizedBlock | null;
  isOpen: boolean;
  onClose: () => void;
}

export function OptimizedBlockDetailDrawer({
  block,
  isOpen,
  onClose,
}: OptimizedBlockDetailDrawerProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !block) return null;

  const depts = block.departments_involved || [];
  const resourceStatus = block.resource_status || "UNVERIFIED";
  const freightInfo = block.freight_impact || "Not available";
  const isIntegrated = block.is_integrated;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div
        className="relative z-10 w-full max-w-xl bg-card border-l border-border shadow-2xl h-full flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="block-detail-title"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border flex items-start justify-between bg-muted/30">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-extrabold text-foreground bg-background px-2.5 py-0.5 rounded border border-border">
                {block.optimized_block_id}
              </span>
              {isIntegrated ? (
                <span className="rounded bg-purple-50 dark:bg-purple-950 px-2 py-0.5 text-[11px] font-bold text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  Integrated Joint Block
                </span>
              ) : (
                <span className="rounded bg-blue-50 dark:bg-blue-950 px-2 py-0.5 text-[11px] font-bold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Single-Dept Block
                </span>
              )}
              <span className="inline-block rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {block.status || "Candidate"}
              </span>
            </div>
            <h2 id="block-detail-title" className="text-base font-bold text-foreground pt-1">
              Optimized Possession Recommendation
            </h2>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close block details"
            className="h-8 w-8 p-0 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* Key Attributes */}
          <div className="bg-muted/20 border border-border rounded p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                Railway Section
              </span>
              <span className="font-mono font-semibold text-foreground mt-0.5 block">
                {block.section_id}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                Block Duration
              </span>
              <span className="font-mono font-semibold text-foreground mt-0.5 block">
                {formatDuration(block.block_duration_hrs)}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                Realized Priority
              </span>
              <span className="font-mono font-extrabold text-blue-600 mt-0.5 block">
                {formatScore(block.realized_priority_value)}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                Resource Status
              </span>
              <span
                className={`inline-block font-semibold mt-0.5 ${
                  resourceStatus === "VERIFIED" ? "text-emerald-600" : "text-amber-600"
                }`}
              >
                {resourceStatus}
              </span>
            </div>
          </div>

          {/* Time Interval Card */}
          <div className="p-3.5 rounded border border-border bg-card space-y-2">
            <span className="text-xs font-bold text-foreground block">
              Scheduled Corridor Window Interval
            </span>
            <div className="flex items-center justify-between text-xs font-mono bg-muted/40 p-2.5 rounded border border-border">
              <div>
                <span className="text-[10px] text-muted-foreground block uppercase">Possession Start</span>
                <span className="font-bold text-foreground">{formatDateTime(block.block_start)}</span>
              </div>
              <span className="text-muted-foreground">→</span>
              <div className="text-right">
                <span className="text-[10px] text-muted-foreground block uppercase">Possession End</span>
                <span className="font-bold text-foreground">{formatDateTime(block.block_end)}</span>
              </div>
            </div>
          </div>

          {/* Priority Value Distinction */}
          <div className="bg-muted/30 border border-border rounded p-3.5 space-y-2">
            <span className="text-xs font-bold text-foreground block">
              Priority Value Realization
            </span>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded bg-background border border-border space-y-1">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">
                  Realized Priority Value
                </span>
                <div className="text-xl font-mono font-extrabold text-blue-600">
                  {formatScore(block.realized_priority_value)}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Score achieved in the optimized global schedule for this task set.
                </p>
              </div>

              <div className="p-2.5 rounded bg-background border border-border space-y-1">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">
                  Candidate Baseline Value
                </span>
                <div className="text-xl font-mono font-bold text-foreground">
                  {formatScore(block.candidate_priority_value ?? block.realized_priority_value)}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Unoptimized screening priority baseline from candidate generation.
                </p>
              </div>
            </div>
          </div>

          {/* Departments Involved */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-foreground block">
              Departments Involved ({depts.length})
            </span>
            <div className="flex flex-wrap gap-2">
              {depts.map((d) => (
                <div
                  key={d}
                  className={`p-2.5 rounded border text-xs font-semibold flex items-center gap-2 ${
                    d === "Engineering"
                      ? "bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                      : d === "S&T"
                      ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                      : "bg-purple-50 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                  }`}
                >
                  <Wrench className="h-3.5 w-3.5" />
                  <span>{d}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tasks Included */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground block">
                Work Orders Scheduled ({block.task_ids.length})
              </span>
              <span className="text-[11px] text-muted-foreground">
                Click work order to inspect in workbench
              </span>
            </div>

            <div className="space-y-1.5">
              {block.task_ids.map((taskId) => (
                <Link
                  key={taskId}
                  href={`/maintenance`}
                  className="p-2.5 rounded border border-border bg-background hover:bg-muted/40 transition-colors flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2">
                    <Wrench className="h-3.5 w-3.5 text-blue-600" />
                    <span className="font-mono text-xs font-bold text-foreground group-hover:text-primary">
                      {taskId}
                    </span>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
                </Link>
              ))}
            </div>
          </div>

          {/* Operational Constraints Summary */}
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="p-3 rounded border border-border bg-muted/20">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                Train Timetable Conflicts
              </span>
              <span className="text-base font-extrabold text-foreground mt-0.5 block">
                {block.train_conflicts} Conflicts
              </span>
            </div>
            <div className="p-3 rounded border border-border bg-muted/20">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                Freight Corridor Impact
              </span>
              <span className="text-base font-extrabold text-foreground mt-0.5 block">
                {freightInfo}
              </span>
            </div>
          </div>

          {/* Mandatory Decision Support Notice */}
          <div className="p-3 rounded border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/30 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Decision Support Output</span>
              <span className="text-[11px]">
                This block is an algorithmic recommendation generated by Google OR-Tools CP-SAT. It represents a Candidate schedule and is NOT an officially approved railway possession until ratified by Divisional Operating Control.
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-muted/40 border-t border-border flex items-center justify-between text-xs text-muted-foreground gap-2 flex-wrap">
          <Link
            href={`/map?run=${block.optimization_run_id}&section=${block.section_id}`}
            className="inline-flex items-center gap-1.5 bg-card border border-border hover:bg-muted text-foreground px-2.5 py-1.5 rounded text-xs font-semibold shadow-xs transition-colors"
          >
            <MapPin className="h-3.5 w-3.5 text-blue-600" />
            <span>View on Map</span>
            <ExternalLink className="h-3 w-3 text-muted-foreground" />
          </Link>
          <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
