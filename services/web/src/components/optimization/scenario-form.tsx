"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OptimizedBlock } from "@/lib/types/optimization";
import { ScenarioCreatePayload } from "@/lib/types/scenario";
import {
  Lock,
  Play,
  RotateCcw,
  Sliders,
  Calendar,
  Layers,
  Clock,
  Scissors,
  ArrowRightLeft,
  Briefcase,
  AlertTriangle,
  Loader2,
  ShieldCheck,
} from "lucide-react";

interface ScenarioFormProps {
  baseRunId: string | number;
  blocks?: OptimizedBlock[];
  onSubmit: (payload: ScenarioCreatePayload) => Promise<void>;
  isLoading: boolean;
  canCreate: boolean;
  initialBlockId?: number | null;
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
  blocks = [],
  onSubmit,
  isLoading,
  canCreate,
  initialBlockId = null,
}: ScenarioFormProps) {
  const [name, setName] = useState("Postpone Block OPT-BLK-0001 by 2h");
  const [scenarioType, setScenarioType] = useState<string>("POSTPONE");
  const [notes, setNotes] = useState(
    "Evaluate train traffic impact and readiness if block is delayed by 2 hours."
  );

  // Target block selection
  const [selectedBlockId, setSelectedBlockId] = useState<number | "">(
    initialBlockId !== null ? initialBlockId : blocks.length > 0 ? blocks[0].id : ""
  );

  // Counterfactual inputs
  const [postponeHours, setPostponeHours] = useState<number>(2.0);
  const [newDurationHrs, setNewDurationHrs] = useState<number>(2.5);
  const [newStartInput, setNewStartInput] = useState<string>("");
  const [newEndInput, setNewEndInput] = useState<string>("");
  const [tasksInput, setTasksInput] = useState<string>("");
  const [departmentsInput, setDepartmentsInput] = useState<string>("");

  // Soft weights state
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);

  // Excluded candidate input (for candidate exclusion scenario)
  const [excludedCandidatesInput, setExcludedCandidatesInput] = useState("");

  // Sync selected block when blocks load
  useEffect(() => {
    if (!selectedBlockId && blocks.length > 0) {
      setSelectedBlockId(blocks[0].id);
    }
  }, [blocks, selectedBlockId]);

  // Update default names when scenario type or selected block changes
  const handleScenarioTypeChange = (newType: string) => {
    setScenarioType(newType);
    const selectedBlock = blocks.find((b) => b.id === Number(selectedBlockId));
    const blockLabel = selectedBlock?.optimized_block_id || `Block #${selectedBlockId || "1"}`;

    if (newType === "POSTPONE") {
      setName(`Postpone ${blockLabel} by ${postponeHours}h`);
      setNotes(`Evaluating train conflicts and readiness if ${blockLabel} is postponed by ${postponeHours} hours.`);
    } else if (newType === "REDUCE_DURATION") {
      setName(`Reduce Duration of ${blockLabel} to ${newDurationHrs}h`);
      setNotes(`Assessing feasibility of reducing possession duration to ${newDurationHrs} hours.`);
    } else if (newType === "MOVE_WINDOW") {
      setName(`Move ${blockLabel} to Alternative Time Window`);
      setNotes(`Testing alternative corridor window slot for ${blockLabel}.`);
    } else if (newType === "CHANGE_TASKS_DEPT") {
      setName(`Adjust Tasks/Departments for ${blockLabel}`);
      setNotes(`Exploring alternative task composition and cross-department synergy.`);
    } else if (newType === "OBJECTIVE_WEIGHTS") {
      setName("High Train Disruption Sensitivity");
      setNotes("Testing high train disruption penalty to assess consolidation impacts.");
    } else if (newType === "HORIZON") {
      setName("Expanded Corridor Planning Horizon");
      setNotes("Testing extended boundary timestamps for corridor possession planning.");
    } else if (newType === "CANDIDATE_EXCLUSION") {
      setName("Unplanned Corridor Window Closure");
      setNotes("Testing network robustness when specific candidate windows are unavailable.");
    }
  };

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

    const taskIds = tasksInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const depts = departmentsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const payload: ScenarioCreatePayload = {
      name: name.trim(),
      scenario_type: scenarioType,
      notes: notes.trim() || undefined,
      ...weights,
      excluded_candidate_ids: excludedIds.length > 0 ? excludedIds : undefined,
      target_block_id: selectedBlockId ? Number(selectedBlockId) : undefined,
      postpone_hours: scenarioType === "POSTPONE" ? Number(postponeHours) : undefined,
      new_duration_hrs: scenarioType === "REDUCE_DURATION" ? Number(newDurationHrs) : undefined,
      new_start: scenarioType === "MOVE_WINDOW" && newStartInput ? new Date(newStartInput).toISOString() : undefined,
      new_end: scenarioType === "MOVE_WINDOW" && newEndInput ? new Date(newEndInput).toISOString() : undefined,
      new_task_ids: scenarioType === "CHANGE_TASKS_DEPT" && taskIds.length > 0 ? taskIds : undefined,
      new_departments: scenarioType === "CHANGE_TASKS_DEPT" && depts.length > 0 ? depts : undefined,
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
                What-If Scenario Configuration
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Select an alternative assumption or counterfactual block adjustment
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
                placeholder="e.g. Postpone Block 0001 by 2h"
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
                placeholder="Briefly state what alternative is being evaluated"
                className="text-xs"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Scenario Type Selection Grid */}
          <div className="space-y-2 pt-1">
            <label className="text-xs font-semibold text-foreground">Scenario Category</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Postpone */}
              <button
                type="button"
                onClick={() => handleScenarioTypeChange("POSTPONE")}
                className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-all ${
                  scenarioType === "POSTPONE"
                    ? "border-blue-600 bg-blue-50/70 text-blue-900 ring-1 ring-blue-600"
                    : "border-border bg-card hover:bg-muted/40"
                }`}
              >
                <div className="p-1 rounded bg-blue-100 text-blue-700 mb-1.5">
                  <Clock className="h-3.5 w-3.5" />
                </div>
                <h4 className="text-xs font-bold">1. Postpone Block</h4>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                  Shift window start & end forward by N hours.
                </p>
              </button>

              {/* Reduce Duration */}
              <button
                type="button"
                onClick={() => handleScenarioTypeChange("REDUCE_DURATION")}
                className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-all ${
                  scenarioType === "REDUCE_DURATION"
                    ? "border-amber-600 bg-amber-50/70 text-amber-900 ring-1 ring-amber-600"
                    : "border-border bg-card hover:bg-muted/40"
                }`}
              >
                <div className="p-1 rounded bg-amber-100 text-amber-700 mb-1.5">
                  <Scissors className="h-3.5 w-3.5" />
                </div>
                <h4 className="text-xs font-bold">2. Reduce Duration</h4>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                  Shorten possession time to free track capacity.
                </p>
              </button>

              {/* Move Window */}
              <button
                type="button"
                onClick={() => handleScenarioTypeChange("MOVE_WINDOW")}
                className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-all ${
                  scenarioType === "MOVE_WINDOW"
                    ? "border-purple-600 bg-purple-50/70 text-purple-900 ring-1 ring-purple-600"
                    : "border-border bg-card hover:bg-muted/40"
                }`}
              >
                <div className="p-1 rounded bg-purple-100 text-purple-700 mb-1.5">
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                </div>
                <h4 className="text-xs font-bold">3. Move Window</h4>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                  Shift block to another time slot or date.
                </p>
              </button>

              {/* Change Tasks/Dept */}
              <button
                type="button"
                onClick={() => handleScenarioTypeChange("CHANGE_TASKS_DEPT")}
                className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-all ${
                  scenarioType === "CHANGE_TASKS_DEPT"
                    ? "border-emerald-600 bg-emerald-50/70 text-emerald-900 ring-1 ring-emerald-600"
                    : "border-border bg-card hover:bg-muted/40"
                }`}
              >
                <div className="p-1 rounded bg-emerald-100 text-emerald-700 mb-1.5">
                  <Briefcase className="h-3.5 w-3.5" />
                </div>
                <h4 className="text-xs font-bold">4. Change Tasks</h4>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                  Modify task set or department composition.
                </p>
              </button>
            </div>

            {/* Secondary Types: Weights, Horizon, Exclusion */}
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <span className="text-[11px] font-semibold text-muted-foreground">Other Scenarios:</span>
              <button
                type="button"
                onClick={() => handleScenarioTypeChange("OBJECTIVE_WEIGHTS")}
                className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                  scenarioType === "OBJECTIVE_WEIGHTS"
                    ? "bg-blue-100 text-blue-800 border-blue-300 font-bold"
                    : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                Objective Weights
              </button>
              <button
                type="button"
                onClick={() => handleScenarioTypeChange("HORIZON")}
                className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                  scenarioType === "HORIZON"
                    ? "bg-purple-100 text-purple-800 border-purple-300 font-bold"
                    : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                Planning Horizon
              </button>
              <button
                type="button"
                onClick={() => handleScenarioTypeChange("CANDIDATE_EXCLUSION")}
                className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                  scenarioType === "CANDIDATE_EXCLUSION"
                    ? "bg-amber-100 text-amber-800 border-amber-300 font-bold"
                    : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                Candidate Exclusion
              </button>
            </div>
          </div>

          {/* Block-Level Counterfactual Target Block Selection */}
          {["POSTPONE", "REDUCE_DURATION", "MOVE_WINDOW", "CHANGE_TASKS_DEPT"].includes(scenarioType) && (
            <div className="p-3.5 rounded-lg border border-blue-200 bg-blue-50/40 space-y-3">
              <div className="flex items-center justify-between">
                <label htmlFor="target-block-select" className="text-xs font-bold text-blue-950">
                  Select Target Baseline Block
                </label>
                <span className="text-[11px] font-medium text-blue-800">
                  {blocks.length} scheduled blocks in Base Run #{baseRunId}
                </span>
              </div>

              {blocks.length > 0 ? (
                <select
                  id="target-block-select"
                  value={selectedBlockId}
                  onChange={(e) => setSelectedBlockId(Number(e.target.value))}
                  disabled={isLoading}
                  className="w-full text-xs font-medium rounded border border-input bg-card p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-blue-600"
                >
                  {blocks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.optimized_block_id || `OPT-BLK-${b.id}`} | {b.section_id} | {b.block_duration_hrs}h | {b.departments_involved?.join(", ") || b.block_type} | Prio: {b.realized_priority_value ? b.realized_priority_value.toFixed(1) : "0.0"}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  type="number"
                  placeholder="Enter Optimized Block ID (e.g. 1)"
                  value={selectedBlockId}
                  onChange={(e) => setSelectedBlockId(Number(e.target.value))}
                  className="text-xs font-mono bg-card"
                  disabled={isLoading}
                />
              )}

              {/* Scenario Specific Controls */}
              {scenarioType === "POSTPONE" && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-blue-950">Postpone Delay Duration:</span>
                    <span className="font-mono font-bold text-blue-700">+{postponeHours} hours</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="12"
                    step="0.5"
                    value={postponeHours}
                    onChange={(e) => setPostponeHours(parseFloat(e.target.value))}
                    disabled={isLoading}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Shifts start & end timestamps forward while preserving tasks, priority, and resource status.
                  </p>
                </div>
              )}

              {scenarioType === "REDUCE_DURATION" && (
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-semibold text-amber-950">
                    Reduced Duration (Hours)
                  </label>
                  <Input
                    type="number"
                    step="0.25"
                    min="0.5"
                    max="12"
                    value={newDurationHrs}
                    onChange={(e) => setNewDurationHrs(parseFloat(e.target.value))}
                    className="text-xs font-mono bg-card"
                    disabled={isLoading}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Simulates shortening the maintenance window to evaluate capacity release vs readiness.
                  </p>
                </div>
              )}

              {scenarioType === "MOVE_WINDOW" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-purple-950">Alternative Window Start (UTC)</label>
                    <Input
                      type="datetime-local"
                      value={newStartInput}
                      onChange={(e) => setNewStartInput(e.target.value)}
                      className="text-xs bg-card"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-purple-950">Alternative Window End (UTC)</label>
                    <Input
                      type="datetime-local"
                      value={newEndInput}
                      onChange={(e) => setNewEndInput(e.target.value)}
                      className="text-xs bg-card"
                      disabled={isLoading}
                    />
                  </div>
                </div>
              )}

              {scenarioType === "CHANGE_TASKS_DEPT" && (
                <div className="space-y-2 pt-1">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-emerald-950">
                      Replacement Task IDs (comma-separated)
                    </label>
                    <Input
                      placeholder="e.g. TASK-ENG-001, TASK-SNT-003"
                      value={tasksInput}
                      onChange={(e) => setTasksInput(e.target.value)}
                      className="text-xs font-mono bg-card"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-emerald-950">
                      Participating Departments (comma-separated)
                    </label>
                    <Input
                      placeholder="e.g. ENGINEERING, SNT, TRD"
                      value={departmentsInput}
                      onChange={(e) => setDepartmentsInput(e.target.value)}
                      className="text-xs font-mono bg-card"
                      disabled={isLoading}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

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

      {/* Objective Weights Tuning (Shown for Global Runs / Weights) */}
      {scenarioType === "OBJECTIVE_WEIGHTS" && (
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
            </div>
          </CardContent>
        </Card>
      )}

      {/* Visibly Locked Hard Invariants */}
      <Card className="shadow-sm border-slate-300 bg-slate-50/70 dark:bg-slate-900/30">
        <CardHeader className="pb-2 border-b border-border/40">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-slate-700" />
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Protected Railway Safety Invariants (Locked)
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
              <span>Evaluating Alternative...</span>
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
