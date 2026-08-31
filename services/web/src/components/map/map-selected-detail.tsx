"use client";

import React from "react";
import Link from "next/link";
import { Station } from "@/lib/types/station";
import { Section } from "@/lib/types/section";
import { MaintenanceTask } from "@/lib/types/maintenance";
import { CandidateBlock } from "@/lib/types/candidate-block";
import { OptimizedBlock } from "@/lib/types/optimization";
import { formatDateTime, formatDuration, formatScore } from "@/lib/utils";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Layers,
  MapPin,
  Shield,
  Sparkles,
  Train,
  Wrench,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export type SelectedMapEntity =
  | { type: "station"; data: Station }
  | { type: "section"; data: Section }
  | { type: "maintenance"; data: MaintenanceTask }
  | { type: "candidate"; data: CandidateBlock }
  | { type: "optimized"; data: OptimizedBlock };

interface MapSelectedDetailProps {
  selection: SelectedMapEntity | null;
  onClearSelection: () => void;
}

export function MapSelectedDetail({
  selection,
  onClearSelection,
}: MapSelectedDetailProps) {
  if (!selection) {
    return (
      <div className="bg-card border border-border rounded p-4 text-center space-y-2 h-full flex flex-col items-center justify-center min-h-[220px]">
        <div className="p-3 rounded-full bg-muted/60 text-muted-foreground">
          <MapPin className="h-6 w-6" />
        </div>
        <div className="space-y-1 max-w-xs">
          <p className="text-xs font-bold text-foreground">No Element Selected</p>
          <p className="text-[11px] text-muted-foreground">
            Click any Station, Section line, Maintenance marker, Candidate window, or Optimized block on the map to inspect its spatial and operational details.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded shadow-md overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="p-3.5 border-b border-border bg-muted/30 flex items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {selection.type === "station" && (
              <span className="rounded bg-slate-900 text-white dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase">
                Station
              </span>
            )}
            {selection.type === "section" && (
              <span className="rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase border border-blue-200 dark:border-blue-800">
                Railway Section
              </span>
            )}
            {selection.type === "maintenance" && (
              <span className="rounded bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase border border-red-200 dark:border-red-800">
                Maintenance Work Order
              </span>
            )}
            {selection.type === "candidate" && (
              <span className="rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase border border-amber-200 dark:border-amber-800">
                Candidate Possession
              </span>
            )}
            {selection.type === "optimized" && (
              <span className="rounded bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase border border-purple-200 dark:border-purple-800">
                Optimized Possession Recommendation
              </span>
            )}
          </div>
          <h3 className="text-sm font-bold text-foreground">
            {selection.type === "station" && `${selection.data.station_name} (${selection.data.station_code})`}
            {selection.type === "section" && `${selection.data.section_name} (${selection.data.section_id})`}
            {selection.type === "maintenance" && `Work Order: ${selection.data.task_id}`}
            {selection.type === "candidate" && `Candidate Window: ${selection.data.candidate_id}`}
            {selection.type === "optimized" && `Optimized Block: ${selection.data.optimized_block_id}`}
          </h3>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          className="h-7 w-7 p-0 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
          title="Clear Selection"
          aria-label="Clear Selection"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Body Content */}
      <div className="p-3.5 space-y-3 flex-1 overflow-y-auto text-xs">
        {/* 1. Station Details */}
        {selection.type === "station" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 bg-muted/20 p-2.5 rounded border border-border text-[11px]">
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Code</span>
                <span className="font-mono font-bold text-foreground">{selection.data.station_code}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Type</span>
                <span className="font-semibold text-foreground">{selection.data.station_type || "Standard"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Division / Zone</span>
                <span className="font-semibold text-foreground">{selection.data.division || "Howrah"} ({selection.data.zone || "ER"})</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Platforms</span>
                <span className="font-semibold text-foreground">{selection.data.platform_available ? "Yes" : "No / Undefined"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Block Station</span>
                <span className="font-semibold text-foreground">{selection.data.block_station ? "Yes" : "No"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Coordinates</span>
                <span className="font-mono text-foreground">
                  {selection.data.latitude != null && selection.data.longitude != null
                    ? `${selection.data.latitude.toFixed(4)}, ${selection.data.longitude.toFixed(4)}`
                    : "Unavailable in dataset"}
                </span>
              </div>
            </div>

            {selection.data.scope_note && (
              <div className="p-2 rounded bg-muted/40 border border-border text-[11px] text-muted-foreground">
                <strong>Scope Note:</strong> {selection.data.scope_note}
              </div>
            )}
          </div>
        )}

        {/* 2. Section Details */}
        {selection.type === "section" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 bg-muted/20 p-2.5 rounded border border-border text-[11px]">
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Section ID</span>
                <span className="font-mono font-bold text-foreground">{selection.data.section_id}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Route Length</span>
                <span className="font-mono font-bold text-foreground">{selection.data.route_km ?? "—"} km</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">From Station</span>
                <span className="font-mono font-semibold text-foreground">{selection.data.from_station_code || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">To Station</span>
                <span className="font-mono font-semibold text-foreground">{selection.data.to_station_code || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Track Count</span>
                <span className="font-semibold text-foreground">{selection.data.track_count ?? "—"} Tracks</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Electrified</span>
                <span className="font-semibold text-foreground">{selection.data.electrified ? "Yes (25kV AC)" : "No"}</span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Signalling System</span>
                <span className="font-semibold text-foreground">{selection.data.signalling_system || "Automatic Block Signalling"}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Link
                href={`/planning?section=${selection.data.section_id}`}
                className="flex-1 inline-flex items-center justify-center gap-1 bg-primary text-primary-foreground py-1.5 px-2.5 rounded text-xs font-semibold hover:bg-blue-800 transition-colors"
              >
                <span>View Candidate Blocks</span>
                <ExternalLink className="h-3 w-3 ml-0.5" />
              </Link>
            </div>
          </div>
        )}

        {/* 3. Maintenance Task Details */}
        {selection.type === "maintenance" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 bg-muted/20 p-2.5 rounded border border-border text-[11px]">
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Department</span>
                <span className="font-semibold text-foreground">{selection.data.department}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Priority Score</span>
                <span className="font-mono font-bold text-red-600 dark:text-red-400">
                  {formatScore(selection.data.priority_score)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Severity</span>
                <span className="font-bold text-foreground">{selection.data.severity || "Standard"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Status</span>
                <span className="font-semibold text-foreground">{selection.data.status}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Section</span>
                <span className="font-mono font-semibold text-foreground">{selection.data.section_id || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Duration</span>
                <span className="font-mono font-semibold text-foreground">{formatDuration(selection.data.required_duration_hrs)}</span>
              </div>
            </div>

            {selection.data.defect_type && (
              <div className="p-2.5 rounded bg-muted/40 border border-border text-[11px] text-foreground">
                <span className="text-muted-foreground font-bold block text-[10px] uppercase">Defect Type / Description</span>
                <p className="mt-0.5">{selection.data.defect_type}</p>
              </div>
            )}

            <div className="pt-1">
              <Link
                href={`/maintenance`}
                className="w-full inline-flex items-center justify-center gap-1.5 bg-primary text-primary-foreground py-1.5 px-3 rounded text-xs font-semibold hover:bg-blue-800 transition-colors"
              >
                <Wrench className="h-3.5 w-3.5" />
                <span>Open in Maintenance Workbench</span>
                <ExternalLink className="h-3 w-3 ml-1" />
              </Link>
            </div>
          </div>
        )}

        {/* 4. Candidate Block Details */}
        {selection.type === "candidate" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 bg-muted/20 p-2.5 rounded border border-border text-[11px]">
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Candidate ID</span>
                <span className="font-mono font-bold text-amber-700 dark:text-amber-400">{selection.data.candidate_id}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Railway Section</span>
                <span className="font-mono font-bold text-foreground">{selection.data.section_id}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Window Interval</span>
                <span className="font-mono text-[10px] text-foreground">
                  {formatDateTime(selection.data.candidate_start || selection.data.window_start)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Required Duration</span>
                <span className="font-mono font-bold text-foreground">
                  {formatDuration(selection.data.required_duration_hrs || selection.data.block_duration_hrs)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Feasibility</span>
                <span className="font-bold text-emerald-600">
                  {selection.data.computed_feasibility_status || selection.data.feasibility_status || "FEASIBLE"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Train Conflicts</span>
                <span className="font-bold text-foreground">
                  {selection.data.train_conflicts ?? selection.data.train_conflict_count ?? 0} Conflicts
                </span>
              </div>
            </div>

            <div className="p-2.5 rounded bg-muted/40 border border-border text-[11px] space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-bold text-[10px] uppercase">Departments</span>
                <span className="font-semibold text-foreground">{selection.data.departments_involved.join(", ")}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-bold text-[10px] uppercase">Work Orders</span>
                <span className="font-mono font-semibold text-foreground">{selection.data.task_ids.length} tasks ({selection.data.task_ids.join(", ")})</span>
              </div>
            </div>

            <div className="pt-1">
              <Link
                href={`/planning`}
                className="w-full inline-flex items-center justify-center gap-1.5 bg-primary text-primary-foreground py-1.5 px-3 rounded text-xs font-semibold hover:bg-blue-800 transition-colors"
              >
                <span>Inspect in Planning Workspace</span>
                <ExternalLink className="h-3 w-3 ml-1" />
              </Link>
            </div>
          </div>
        )}

        {/* 5. Optimized Block Details */}
        {selection.type === "optimized" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 bg-muted/20 p-2.5 rounded border border-border text-[11px]">
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Optimized Block ID</span>
                <span className="font-mono font-bold text-purple-700 dark:text-purple-400">{selection.data.optimized_block_id}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Railway Section</span>
                <span className="font-mono font-bold text-foreground">{selection.data.section_id}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Scheduled Start</span>
                <span className="font-mono text-[10px] text-foreground">{formatDateTime(selection.data.block_start)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Scheduled End</span>
                <span className="font-mono text-[10px] text-foreground">{formatDateTime(selection.data.block_end)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Duration</span>
                <span className="font-mono font-bold text-foreground">{formatDuration(selection.data.block_duration_hrs)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Realized Priority</span>
                <span className="font-mono font-extrabold text-blue-600">
                  {formatScore(selection.data.realized_priority_value)}
                </span>
              </div>
            </div>

            <div className="p-2.5 rounded bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900 text-[11px] space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-purple-900 dark:text-purple-200 font-bold text-[10px] uppercase">Departments</span>
                <span className="font-semibold text-purple-950 dark:text-purple-100">{selection.data.departments_involved.join(", ")}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-purple-900 dark:text-purple-200 font-bold text-[10px] uppercase">Work Orders Scheduled</span>
                <span className="font-mono font-semibold text-purple-950 dark:text-purple-100">
                  {selection.data.task_ids.length} ({selection.data.task_ids.join(", ")})
                </span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-purple-200 dark:border-purple-800">
                <span className="text-purple-900 dark:text-purple-200 font-bold text-[10px] uppercase">Candidate Baseline</span>
                <span className="font-mono text-purple-900 dark:text-purple-200">
                  {formatScore(selection.data.candidate_priority_value ?? selection.data.realized_priority_value)}
                </span>
              </div>
            </div>

            <div className="p-2 rounded bg-slate-50 dark:bg-slate-900 border border-border text-[10px] text-muted-foreground">
              <strong>Advisory:</strong> Computational solver recommendation from OR-Tools CP-SAT. Final execution requires authorized human clearance.
            </div>

            <div className="pt-1">
              <Link
                href={`/optimization/runs/${selection.data.optimization_run_id}`}
                className="w-full inline-flex items-center justify-center gap-1.5 bg-primary text-primary-foreground py-1.5 px-3 rounded text-xs font-semibold hover:bg-blue-800 transition-colors"
              >
                <span>View Full Optimization Plan</span>
                <ExternalLink className="h-3 w-3 ml-1" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
