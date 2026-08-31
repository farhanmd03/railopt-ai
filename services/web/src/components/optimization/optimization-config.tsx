"use client";

import React, { useState } from "react";
import { OptimizationRunCreateRequest } from "@/lib/types/optimization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  HelpCircle,
  Lock,
  Play,
  RotateCcw,
  Sliders,
  Sparkles,
  Zap,
} from "lucide-react";

export interface PlannerConfigState {
  planningStart: string;
  planningEnd: string;
  solverTimeLimitSeconds: number;
  weightPriorityScore: number;
  weightIntegratedTaskBonus: number;
  weightTasksScheduled: number;
  weightOverdueMitigation: number;
  weightTrainDisruption: number;
  weightFreightImpact: number;
  weightUnusedWindowTime: number;
  weightTotalBlockCount: number;
}

export const DEFAULT_PLANNER_CONFIG: PlannerConfigState = {
  planningStart: "2026-08-31",
  planningEnd: "2026-09-06",
  solverTimeLimitSeconds: 30,
  weightPriorityScore: 1.0,
  weightIntegratedTaskBonus: 0.5,
  weightTasksScheduled: 0.8,
  weightOverdueMitigation: 0.3,
  weightTrainDisruption: 2.0,
  weightFreightImpact: 0.5,
  weightUnusedWindowTime: 0.2,
  weightTotalBlockCount: 0.1,
};

interface OptimizationConfigProps {
  config: PlannerConfigState;
  onChange: (config: PlannerConfigState) => void;
  onGenerate: () => void;
  isGenerating?: boolean;
  canGenerate?: boolean;
}

export function OptimizationConfig({
  config,
  onChange,
  onGenerate,
  isGenerating,
  canGenerate = true,
}: OptimizationConfigProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Validate dates: start must be strictly before end
  const isValidHorizon =
    Boolean(config.planningStart) &&
    Boolean(config.planningEnd) &&
    config.planningStart < config.planningEnd;

  const handleReset = () => {
    onChange(DEFAULT_PLANNER_CONFIG);
  };

  return (
    <div className="bg-card border border-border rounded shadow-xs p-4 sm:p-5 space-y-5">
      {/* Header & Reset Action */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-blue-600" />
          <h2 className="text-sm font-bold text-foreground">
            Optimization Parameters & Horizon Configuration
          </h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3 w-3" />
          <span>Reset Defaults</span>
        </Button>
      </div>

      {/* Two-Column Form Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Column 1: Planning Horizon & Core Objective Weights */}
        <div className="space-y-4">
          <div>
            <span className="text-xs font-bold text-foreground block mb-2">
              1. Planning Horizon Window
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="planning-start-input"
                  className="text-[11px] font-semibold text-muted-foreground block mb-1"
                >
                  Planning Start Date
                </label>
                <Input
                  id="planning-start-input"
                  type="date"
                  value={config.planningStart}
                  onChange={(e) =>
                    onChange({ ...config, planningStart: e.target.value })
                  }
                  className="h-8 text-xs bg-background"
                />
              </div>
              <div>
                <label
                  htmlFor="planning-end-input"
                  className="text-[11px] font-semibold text-muted-foreground block mb-1"
                >
                  Planning End Date
                </label>
                <Input
                  id="planning-end-input"
                  type="date"
                  value={config.planningEnd}
                  onChange={(e) =>
                    onChange({ ...config, planningEnd: e.target.value })
                  }
                  className="h-8 text-xs bg-background"
                />
              </div>
            </div>

            {!isValidHorizon && (
              <div className="mt-2 text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5 font-medium">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>Planning end date must be strictly after planning start date.</span>
              </div>
            )}
          </div>

          {/* Soft Objective Weights Controls */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">
                2. Soft Objective Weights (CP-SAT Solver)
              </span>
              <span className="text-[10px] text-muted-foreground">
                Domain Default Values Active
              </span>
            </div>

            {/* Priority Score Weight */}
            <div className="bg-muted/20 border border-border p-2.5 rounded space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">
                  Task Priority Score Weight
                </span>
                <span className="font-mono font-bold text-blue-600">
                  {config.weightPriorityScore.toFixed(1)}x
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Maximizes aggregate priority score of scheduled tasks.
              </p>
              <input
                type="range"
                min="0.0"
                max="5.0"
                step="0.1"
                value={config.weightPriorityScore}
                onChange={(e) =>
                  onChange({
                    ...config,
                    weightPriorityScore: parseFloat(e.target.value),
                  })
                }
                className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            {/* Integrated Task Bonus */}
            <div className="bg-muted/20 border border-border p-2.5 rounded space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">
                  Integrated Multi-Task Bonus
                </span>
                <span className="font-mono font-bold text-purple-600">
                  {config.weightIntegratedTaskBonus.toFixed(1)}x
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Extra reward for consolidating cross-department tasks in the same corridor block.
              </p>
              <input
                type="range"
                min="0.0"
                max="5.0"
                step="0.1"
                value={config.weightIntegratedTaskBonus}
                onChange={(e) =>
                  onChange({
                    ...config,
                    weightIntegratedTaskBonus: parseFloat(e.target.value),
                  })
                }
                className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
            </div>

            {/* Train Disruption Penalty */}
            <div className="bg-muted/20 border border-border p-2.5 rounded space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">
                  Train Timetable Disruption Penalty
                </span>
                <span className="font-mono font-bold text-red-600">
                  {config.weightTrainDisruption.toFixed(1)}x
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Heavily penalizes candidate blocks overlapping with passenger train paths.
              </p>
              <input
                type="range"
                min="0.0"
                max="5.0"
                step="0.1"
                value={config.weightTrainDisruption}
                onChange={(e) =>
                  onChange({
                    ...config,
                    weightTrainDisruption: parseFloat(e.target.value),
                  })
                }
                className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-red-600"
              />
            </div>
          </div>
        </div>

        {/* Column 2: Hard Invariants & Advanced Objective Controls */}
        <div className="space-y-4">
          {/* Mandatory Hard Invariants (Protected) */}
          <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded p-3.5 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
              <Lock className="h-3.5 w-3.5 text-blue-600" />
              <span>Mandatory Safety & Integrity Invariants (Protected)</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              These fundamental railway constraints are strictly enforced by the CP-SAT engine and cannot be bypassed:
            </p>
            <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>Single Task Assignment: Each work order is scheduled at most once.</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>Section Exclusivity: Zero simultaneous overlapping blocks in the same section.</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>Horizon Invariant: Blocks must start and finish strictly within horizon bounds.</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>Candidate Feasibility: Minimum required maintenance duration strictly respected.</span>
              </li>
            </ul>
          </div>

          {/* Advanced Objective Weights Toggle */}
          <div className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs text-blue-600 hover:text-blue-700 p-0 h-6 font-semibold"
            >
              {showAdvanced ? "− Hide Secondary Penalties" : "+ Show Secondary Penalties"}
            </Button>

            {showAdvanced && (
              <div className="space-y-2.5 p-3 rounded bg-muted/20 border border-border animate-in fade-in">
                {/* Tasks Scheduled Weight */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Tasks Scheduled Weight</span>
                    <span className="font-mono font-semibold">{config.weightTasksScheduled.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="3.0"
                    step="0.1"
                    value={config.weightTasksScheduled}
                    onChange={(e) =>
                      onChange({ ...config, weightTasksScheduled: parseFloat(e.target.value) })
                    }
                    className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>

                {/* Overdue Backlog Mitigation */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Overdue Backlog Mitigation</span>
                    <span className="font-mono font-semibold">{config.weightOverdueMitigation.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="3.0"
                    step="0.1"
                    value={config.weightOverdueMitigation}
                    onChange={(e) =>
                      onChange({ ...config, weightOverdueMitigation: parseFloat(e.target.value) })
                    }
                    className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>

                {/* Freight Impact Penalty */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Freight Impact Penalty</span>
                    <span className="font-mono font-semibold">{config.weightFreightImpact.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="3.0"
                    step="0.1"
                    value={config.weightFreightImpact}
                    onChange={(e) =>
                      onChange({ ...config, weightFreightImpact: parseFloat(e.target.value) })
                    }
                    className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>

                {/* Unused Window Time */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Unused Window Time Penalty</span>
                    <span className="font-mono font-semibold">{config.weightUnusedWindowTime.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="3.0"
                    step="0.1"
                    value={config.weightUnusedWindowTime}
                    onChange={(e) =>
                      onChange({ ...config, weightUnusedWindowTime: parseFloat(e.target.value) })
                    }
                    className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Mandatory Decision Support Advisory */}
          <div className="p-3 rounded border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Decision Support Advisory</span>
              <span className="text-[11px]">
                Optimization generates candidate planning recommendations. Final operational block execution requires divisional human review and authorized railway possession clearance.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Action Button */}
      <div className="pt-2 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          {!canGenerate ? (
            <span className="text-amber-600 font-semibold">
              Read-only mode (VIEWER role cannot trigger solver runs).
            </span>
          ) : (
            <span>
              Solver Time Limit: <strong className="text-foreground">{config.solverTimeLimitSeconds}s</strong> • Engine: Google OR-Tools CP-SAT
            </span>
          )}
        </div>

        <Button
          size="default"
          onClick={onGenerate}
          disabled={!isValidHorizon || isGenerating || !canGenerate}
          className="w-full sm:w-auto h-10 px-6 gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm"
        >
          {isGenerating ? (
            <>
              <Cpu className="h-4 w-4 animate-spin" />
              <span>Formulating & Solving...</span>
            </>
          ) : (
            <>
              <Play className="h-4 w-4 fill-current" />
              <span>Generate Optimal Plan</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
