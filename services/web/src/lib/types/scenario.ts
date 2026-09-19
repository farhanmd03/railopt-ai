/**
 * What-If Scenario Analysis and Counterfactual Planning Type Definitions (Badge 3).
 */

import { OptimizationRun, OptimizedBlock } from "./optimization";

export interface ReadinessCheck {
  key: string;
  label: string;
  status: "PASS" | "PENDING" | "FAIL";
  message: string;
}

export interface PossessionReadinessResponse {
  block_id: number;
  readiness: "GO" | "HOLD" | "REDUCE";
  summary: string;
  checks: ReadinessCheck[];
  human_decision_required?: boolean;
}

export interface CounterfactualBlockData {
  block_id?: number | null;
  optimized_block_id?: string | null;
  section_id: string;
  block_start: string;
  block_end: string;
  duration_hrs: number;
  is_integrated: boolean;
  departments: string[];
  task_ids: string[];
  priority_score: number;
  train_conflicts: number;
  conflict_trains?: string[];
  estimated_impact_score: number;
  readiness?: PossessionReadinessResponse | null;
}

export interface CounterfactualComparison {
  target_block_id: number;
  scenario_type: string;
  rating: "BETTER" | "WORSE" | "NEUTRAL" | string;
  explanation: string;
  baseline: CounterfactualBlockData;
  alternative: CounterfactualBlockData;
  deltas: {
    duration_delta: number;
    priority_delta: number;
    train_conflicts_delta: number;
    estimated_impact_delta: number;
    tasks_added: string[];
    tasks_removed: string[];
    readiness_change: "IMPROVED" | "DEGRADED" | "UNCHANGED" | string;
  };
}

export interface BlockCounterfactualRequest {
  scenario_type: "POSTPONE" | "REDUCE_DURATION" | "MOVE_WINDOW" | "CHANGE_TASKS_DEPT" | string;
  postpone_hours?: number;
  new_start?: string | null;
  new_end?: string | null;
  new_duration_hrs?: number;
  new_task_ids?: string[];
  new_departments?: string[];
  notes?: string;
}

export interface ScenarioMetricDelta {
  original: number;
  scenario: number;
  delta: number;
}

export interface ScenarioComparisonSummary {
  tasks_scheduled: ScenarioMetricDelta;
  tasks_unassigned: ScenarioMetricDelta;
  block_count: ScenarioMetricDelta;
  integrated_blocks: ScenarioMetricDelta;
  estimated_total_block_hours: ScenarioMetricDelta;
  objective_value: ScenarioMetricDelta;
  explanation: string;
}

export interface ScenarioTaskImpact {
  retained_task_ids: string[];
  newly_unassigned_task_ids: string[];
  newly_scheduled_task_ids: string[];
  changed_block_task_ids: string[];
}

export interface ScenarioBlockSummary {
  added_block_count: number;
  removed_block_count: number;
  retained_block_count: number;
  added_blocks: OptimizedBlock[];
  removed_blocks: OptimizedBlock[];
  retained_blocks: OptimizedBlock[];
}

export interface OptimizationScenario {
  id: number;
  scenario_id: string;
  name: string;
  scenario_type:
    | "OBJECTIVE_WEIGHTS"
    | "HORIZON"
    | "CANDIDATE_EXCLUSION"
    | "POSTPONE"
    | "REDUCE_DURATION"
    | "MOVE_WINDOW"
    | "CHANGE_TASKS_DEPT"
    | string;
  status: "SCENARIO_CREATED" | "RUNNING" | "COMPLETED" | "INFEASIBLE" | "FAILED" | string;
  base_run_id: number;
  scenario_run_id?: number | null;
  created_by?: string | null;
  parameters?: Record<string, any>;
  notes?: string | null;
  created_at?: string | null;
  base_run?: OptimizationRun | null;
  scenario_run?: OptimizationRun | null;
  comparison?: ScenarioComparisonSummary | null;
  task_impact?: ScenarioTaskImpact | null;
  block_differences?: ScenarioBlockSummary | null;
  counterfactual_comparison?: CounterfactualComparison | null;
}

export interface ScenarioCreatePayload {
  name: string;
  scenario_type?: string;
  planning_start?: string | null;
  planning_end?: string | null;
  solver_time_limit_seconds?: number;
  weight_priority_score?: number;
  weight_integrated_task_bonus?: number;
  weight_tasks_scheduled?: number;
  weight_overdue_mitigation?: number;
  weight_train_disruption?: number;
  weight_freight_impact?: number;
  weight_unused_window_time?: number;
  weight_total_block_count?: number;
  excluded_candidate_ids?: string[];
  target_block_id?: number | null;
  postpone_hours?: number | null;
  new_start?: string | null;
  new_end?: string | null;
  new_duration_hrs?: number | null;
  new_task_ids?: string[];
  new_departments?: string[];
  notes?: string;
}

export interface ScenarioListResponse {
  items: OptimizationScenario[];
  total: number;
}
