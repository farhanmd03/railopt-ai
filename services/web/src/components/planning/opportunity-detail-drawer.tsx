"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { IntegrationOpportunity } from "@/lib/types/maintenance";
import { formatDuration, formatScore } from "@/lib/utils";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  Layers,
  MapPin,
  Shield,
  Shuffle,
  Wrench,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface OpportunityDetailDrawerProps {
  opportunity: IntegrationOpportunity | null;
  isOpen: boolean;
  onClose: () => void;
  onFilterCandidatesForOpportunity?: (opportunityId: string, sectionId: string) => void;
}

export function OpportunityDetailDrawer({
  opportunity,
  isOpen,
  onClose,
  onFilterCandidatesForOpportunity,
}: OpportunityDetailDrawerProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !opportunity) return null;

  const depts = opportunity.departments_involved || [];

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
        aria-labelledby="opportunity-detail-title"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border flex items-start justify-between bg-muted/30">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-extrabold text-foreground bg-background px-2.5 py-0.5 rounded border border-border">
                {opportunity.opportunity_id}
              </span>
              <span className="rounded bg-purple-50 dark:bg-purple-950 px-2 py-0.5 text-[11px] font-bold text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                {opportunity.compatibility_score}% Compatible
              </span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {opportunity.compatibility_status}
              </span>
            </div>
            <h2 id="opportunity-detail-title" className="text-base font-bold text-foreground pt-1">
              Co-Located Integrated Block Candidate
            </h2>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close opportunity details"
            className="h-8 w-8 p-0 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* Key Attributes Grid */}
          <div className="bg-muted/20 border border-border rounded p-3.5 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                Railway Section
              </span>
              <span className="font-mono font-semibold text-foreground mt-0.5 block">
                {opportunity.section_id}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                Combined Duration
              </span>
              <span className="font-mono font-semibold text-foreground mt-0.5 block">
                {formatDuration(opportunity.combined_duration_hrs)}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                Total Priority Value
              </span>
              <span className="font-mono font-extrabold text-foreground mt-0.5 block">
                {formatScore(opportunity.priority_summary?.total_priority_value)}
              </span>
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

          {/* Tasks Included with Direct Maintenance Links */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground block">
                Co-Located Work Orders ({opportunity.task_ids.length})
              </span>
              <span className="text-[11px] text-muted-foreground">
                Click task to view in workbench
              </span>
            </div>

            <div className="space-y-1.5">
              {opportunity.task_ids.map((taskId) => (
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

          {/* Priority Summary Breakdown */}
          {opportunity.priority_summary && (
            <div className="bg-muted/30 border border-border rounded p-3.5 space-y-2.5">
              <span className="text-xs font-bold text-foreground block">
                Combined Priority Synthesis
              </span>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-2 rounded bg-background border border-border">
                  <div className="text-[10px] text-muted-foreground font-semibold">Highest Task</div>
                  <div className="font-mono font-bold text-foreground mt-0.5">
                    {formatScore(opportunity.priority_summary.highest_task_priority)}
                  </div>
                </div>
                <div className="p-2 rounded bg-background border border-border">
                  <div className="text-[10px] text-muted-foreground font-semibold">Average Task</div>
                  <div className="font-mono font-bold text-foreground mt-0.5">
                    {formatScore(opportunity.priority_summary.average_task_priority)}
                  </div>
                </div>
                <div className="p-2 rounded bg-background border border-border">
                  <div className="text-[10px] text-muted-foreground font-semibold">Total Combined</div>
                  <div className="font-mono font-extrabold text-foreground mt-0.5">
                    {formatScore(opportunity.priority_summary.total_priority_value)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Compatibility Engine Reasons */}
          {opportunity.compatibility_reasons && opportunity.compatibility_reasons.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                Compatibility Rules & Screening Evaluation
              </span>
              <ul className="space-y-1 bg-muted/20 p-3 rounded border border-border">
                {opportunity.compatibility_reasons.map((reason, idx) => (
                  <li key={idx} className="text-xs text-foreground flex items-start gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-purple-600 shrink-0 mt-0.5" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Mandatory Candidate Screening Advisory */}
          <div className="p-3 rounded border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/30 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Planning Screening Signal</span>
              <span className="text-[11px]">
                This is a potential integration opportunity evaluated for combinatorial corridor scheduling. It is NOT an approved or scheduled track possession block until authorized by Divisional Operations.
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 bg-muted/40 border-t border-border flex items-center justify-between gap-2">
          {onFilterCandidatesForOpportunity && (
            <Button
              size="sm"
              onClick={() => {
                onFilterCandidatesForOpportunity(opportunity.opportunity_id, opportunity.section_id);
                onClose();
              }}
              className="gap-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Explore Window Candidates</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}

          <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs ml-auto">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
