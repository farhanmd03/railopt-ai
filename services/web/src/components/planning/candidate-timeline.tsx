"use client";

import React from "react";
import { CandidateBlock } from "@/lib/types/candidate-block";
import { formatDateTime, formatDuration, formatScore } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Clock, Train } from "lucide-react";

interface CandidateTimelineProps {
  candidates: CandidateBlock[];
  selectedCandidateId: string | null;
  onSelectCandidate: (candidate: CandidateBlock) => void;
  sectionId?: string;
}

export function CandidateTimeline({
  candidates,
  selectedCandidateId,
  onSelectCandidate,
  sectionId,
}: CandidateTimelineProps) {
  if (candidates.length === 0) {
    return null;
  }

  // Display top 8 candidates visually in a compact corridor timeline grid
  const displayCandidates = candidates.slice(0, 8);

  return (
    <div className="bg-card border border-border rounded p-3.5 shadow-xs space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-600 shrink-0" />
          <span className="text-xs font-bold text-foreground">
            Candidate Corridor Windows Timeline {sectionId ? `(${sectionId})` : ""}
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground">
          Showing {displayCandidates.length} window intervals
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {displayCandidates.map((c) => {
          const isSelected = selectedCandidateId === c.candidate_id;
          const status = c.computed_feasibility_status || c.feasibility_status || "FEASIBLE";
          const isFeasible = status === "FEASIBLE";
          const hasConflict = status === "TRAIN_CONFLICT" || Boolean(c.train_conflict);

          return (
            <div
              key={c.candidate_id}
              onClick={() => onSelectCandidate(c)}
              className={`p-2.5 rounded border text-xs cursor-pointer transition-all ${
                isSelected
                  ? "border-blue-600 bg-blue-50/80 dark:bg-blue-950/60 ring-2 ring-blue-500/30"
                  : hasConflict
                  ? "border-red-200 dark:border-red-900 bg-red-50/30 dark:bg-red-950/20 hover:border-red-300"
                  : "border-border bg-background hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-mono text-[11px] font-bold text-foreground truncate">
                  {c.window_id}
                </span>
                <span
                  className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded ${
                    isFeasible
                      ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                      : hasConflict
                      ? "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
                      : "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                  }`}
                >
                  {status}
                </span>
              </div>

              <div className="mt-1 text-[11px] text-muted-foreground">
                <span>{formatDateTime(c.candidate_start)}</span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1 pt-1 border-t border-border/50">
                <span>Duration: <strong className="text-foreground">{formatDuration(c.required_duration_hrs || c.block_duration_hrs)}</strong></span>
                <span>Score: <strong className="text-foreground">{formatScore(c.priority_score)}</strong></span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
