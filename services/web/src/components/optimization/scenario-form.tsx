"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScenarioCreatePayload } from "@/lib/types/scenario";
import {
  Lock,
  Play,
  RotateCcw,
  Sliders,
  Calendar,
  Layers,
  AlertTriangle,
  Loader2,
  ShieldCheck,
} from "lucide-react";

interface ScenarioFormProps {
  baseRunId: string | number;
  onSubmit: (payload: ScenarioCreatePayload) => Promise<void>;
  isLoading: boolean;
  canCreate: boolean;
}

const DEFAULT_WEIGHTS = {
  weight_priority_score: 1.0,
  weight_integrated_task_bonus: 10.0,
  weight_tasks_scheduled: 5.0,
  weight_overdue_mitigation: 2.0,
  weight_train_disruption: 8.0,
  weight_freight_impact: 3.0,
  weight_unused_window_time: 0.5,
  weight_total_block_count: 1.0,
};

export function ScenarioForm({
  baseRunId,
  onSubmit,
  isLoading,
  canCreate,
}: ScenarioFormProps) {
  const [name, setName] = useState("High Train Disruption Sensitivity");
  const [scenarioType, setScenarioType] = useState<string>("OBJECTIVE_WEIGHTS");
  const [notes, setNotes] = useState(
    "Testing high train disruption penalty to assess consolidation impacts."
  );

  // Soft weights state
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);

  // Excluded candidate input (for candidate exclusion scenario)
  const [excludedCandidatesInput, setExcludedCandidatesInput] = useState("");

  const handleWeightChange = (key: keyof typeof DEFAULT_WEIGHTS, val: number) => {
    setWeights((prev) => ({
      ...prev,
      [key]: Math.max(0, Math.min(100, val)),
    }));
  };

  const handleResetWeights = () => {
    setWeights(DEFAULT_WEIGHTS);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isLoading || !canCreate) return;

    const excludedIds = excludedCandidatesInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const payload: ScenarioCreatePayload = {
      name: name.trim(),
      scenario_type: scenarioType,
      notes: notes.trim() || undefined,
      ...weights,
      excluded_candidate_ids: excludedIds.length > 0 ? excludedIds : undefined,
    };

    await onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Scenario Metadata Card */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold text-foreground">
                Scenario Configuration
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Define the experimental hypothesis and modified planning assumptions
              </p>
            </div>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
              SCENARIO RUN — EXPERIMENTAL
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="scenario-name" className="text-xs font-semibold text-foreground">
                Scenario Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="scenario-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. High Train Disruption Sensitivity"
                required
                className="text-xs font-medium"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="scenario-notes" className="text-xs font-semibold text-foreground">
                Operational Notes / Hypothesis
              </label>
              <Input
                id="scenario-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Briefly state what assumption is being evaluated"
                className="text-xs"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Scenario Type Selection */}
          <div className="space-y-2 pt-1">
            <label className="text-xs font-semibold text-foreground">Scenario Type</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setScenarioType("OBJECTIVE_WEIGHTS")}
                className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                  scenarioType === "OBJECTIVE_WEIGHTS"
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border bg-card hover:bg-muted/40"
                }`}
              >
                <div className="p-1.5 rounded bg-blue-100 text-blue-700 mt-0.5">
                  <Sliders className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground">Objective Weights</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Tune penalties & bonuses for disruption, overdue, or consolidation.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setScenarioType("HORIZON")}
                className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                  scenarioType === "HORIZON"
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border bg-card hover:bg-muted/40"
                }`}
              >
                <div className="p-1.5 rounded bg-purple-100 text-purple-700 mt-0.5">
                  <Calendar className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground">Planning Horizon</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Adjust scheduling time boundaries across the corridor.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setScenarioType("CANDIDATE_EXCLUSION")}
                className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                  scenarioType === "CANDIDATE_EXCLUSION"
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border bg-card hover:bg-muted/40"
                }`}
              >
                <div className="p-1.5 rounded bg-amber-100 text-amber-700 mt-0.5">
                  <Layers className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground">Candidate Exclusion</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Omit specific possession windows to simulate unforeseen closures.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Conditional Candidate Exclusion Input */}
          {scenarioType === "CANDIDATE_EXCLUSION" && (
            <div className="space-y-1.5 pt-2 bg-amber-50/50 p-3 rounded-md border border-amber-200">
              <label htmlFor="excluded-candidates" className="text-xs font-semibold text-amber-900">
                Excluded Candidate Block IDs (Comma-separated)
              </label>
              <Input
                id="excluded-candidates"
                value={excludedCandidatesInput}
                onChange={(e) => setExcludedCandidatesInput(e.target.value)}
                placeholder="e.g. CAND-HWH-001, CAND-BWN-004"
                className="text-xs font-mono bg-card"
                disabled={isLoading}
              />
              <p className="text-[11px] text-amber-800">
                The CP-SAT solver will cleanly remove these candidate blocks from its decision universe.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Objective Weights Tuning */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-foreground">
                Soft Objective Weights
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Adjust multi-criteria trade-offs evaluated by Google OR-Tools CP-SAT
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetWeights}
              disabled={isLoading}
              className="text-xs h-7 gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              Reset Defaults
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            {/* Train Disruption Penalty */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-foreground">Train Disruption Penalty</span>
                <span className="font-mono font-bold text-blue-700">{weights.weight_train_disruption}</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                step="0.5"
                value={weights.weight_train_disruption}
                onChange={(e) => handleWeightChange("weight_train_disruption", parseFloat(e.target.value))}
                disabled={isLoading}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <p className="text-[10px] text-muted-foreground">Penalizes scheduled blocks that cross high train traffic times</p>
            </div>

            {/* Integrated Task Bonus */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-foreground">Integrated Task Bonus</span>
                <span className="font-mono font-bold text-purple-700">{weights.weight_integrated_task_bonus}</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                step="0.5"
                value={weights.weight_integrated_task_bonus}
                onChange={(e) => handleWeightChange("weight_integrated_task_bonus", parseFloat(e.target.value))}
                disabled={isLoading}
                className="w-full accent-purple-600 cursor-pointer"
              />
              <p className="text-[10px] text-muted-foreground">Rewards combining Engineering, S&T, and TRD tasks into single blocks</p>
            </div>

            {/* Tasks Scheduled Weight */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-foreground">Tasks Scheduled Weight</span>
                <span className="font-mono font-bold text-emerald-700">{weights.weight_tasks_scheduled}</span>
              </div>
              <input
                type="range"
                min="0"
                max="25"
                step="0.5"
                value={weights.weight_tasks_scheduled}
                onChange={(e) => handleWeightChange("weight_tasks_scheduled", parseFloat(e.target.value))}
                disabled={isLoading}
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <p className="text-[10px] text-muted-foreground">Encourages solver to maximize total number of completed work orders</p>
            </div>

            {/* Overdue Task Urgency */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-foreground">Overdue Task Urgency</span>
                <span className="font-mono font-bold text-amber-700">{weights.weight_overdue_mitigation}</span>
              </div>
              <input
                type="range"
                min="0"
                max="25"
                step="0.5"
                value={weights.weight_overdue_mitigation}
                onChange={(e) => handleWeightChange("weight_overdue_mitigation", parseFloat(e.target.value))}
                disabled={isLoading}
                className="w-full accent-amber-600 cursor-pointer"
              />
              <p className="text-[10px] text-muted-foreground">Prioritizes severely delayed maintenance items</p>
            </div>

            {/* Freight Impact Penalty */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-foreground">Freight Impact Penalty</span>
                <span className="font-mono font-bold text-slate-700">{weights.weight_freight_impact}</span>
              </div>
              <input
                type="range"
                min="0"
                max="25"
                step="0.5"
                value={weights.weight_freight_impact}
                onChange={(e) => handleWeightChange("weight_freight_impact", parseFloat(e.target.value))}
                disabled={isLoading}
                className="w-full accent-slate-600 cursor-pointer"
              />
              <p className="text-[10px] text-muted-foreground">Penalizes corridors with heavy forecasted freight tonnage</p>
            </div>

            {/* Total Block Count Penalty */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-foreground">Block Fragmentation Penalty</span>
                <span className="font-mono font-bold text-rose-700">{weights.weight_total_block_count}</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="0.1"
                value={weights.weight_total_block_count}
                onChange={(e) => handleWeightChange("weight_total_block_count", parseFloat(e.target.value))}
                disabled={isLoading}
                className="w-full accent-rose-600 cursor-pointer"
              />
              <p className="text-[10px] text-muted-foreground">Discourages excessive isolated track possessions</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Visibly Locked Hard Invariants */}
      <Card className="shadow-sm border-slate-300 bg-slate-50/70 dark:bg-slate-900/30">
        <CardHeader className="pb-2 border-b border-border/40">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-slate-700" />
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Protected Railway Engineering Invariants (Locked)
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-xs">
            <div className="flex items-center gap-1.5 p-2 rounded bg-card border border-border shadow-2xs">
              <Lock className="h-3 w-3 text-slate-600 shrink-0" />
              <span className="font-medium text-foreground">Single Task Assignment</span>
            </div>
            <div className="flex items-center gap-1.5 p-2 rounded bg-card border border-border shadow-2xs">
              <Lock className="h-3 w-3 text-slate-600 shrink-0" />
              <span className="font-medium text-foreground">Section Exclusivity</span>
            </div>
            <div className="flex items-center gap-1.5 p-2 rounded bg-card border border-border shadow-2xs">
              <Lock className="h-3 w-3 text-slate-600 shrink-0" />
              <span className="font-medium text-foreground">Train Conflict Rules</span>
            </div>
            <div className="flex items-center gap-1.5 p-2 rounded bg-card border border-border shadow-2xs">
              <Lock className="h-3 w-3 text-slate-600 shrink-0" />
              <span className="font-medium text-foreground">Horizon Boundaries</span>
            </div>
            <div className="flex items-center gap-1.5 p-2 rounded bg-card border border-border shadow-2xs">
              <Lock className="h-3 w-3 text-slate-600 shrink-0" />
              <span className="font-medium text-foreground">Resource Feasibility</span>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 italic">
            *Hard safety constraints cannot be bypassed or weakened in What-If scenarios.
          </p>
        </CardContent>
      </Card>

      {/* Submission CTA */}
      <div className="flex items-center justify-between pt-2">
        <div className="text-xs text-muted-foreground">
          Base Run #{baseRunId} will remain completely immutable.
        </div>
        <Button
          type="submit"
          disabled={isLoading || !canCreate || !name.trim()}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 px-5 gap-2 shadow-sm"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Solving Scenario...</span>
            </>
          ) : (
            <>
              <Play className="h-4 w-4 fill-current" />
              <span>Run What-If Scenario</span>
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
