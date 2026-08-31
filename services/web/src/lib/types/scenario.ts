/**
 * What-If Scenario Analysis Type Definitions (Batch 7K).
 */

import { OptimizationRun, OptimizedBlock } from "./optimization";

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
  scenario_type: "OBJECTIVE_WEIGHTS" | "HORIZON" | "CANDIDATE_EXCLUSION" | string;
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
  notes?: string;
}

export interface ScenarioListResponse {
  items: OptimizationScenario[];
  total: number;
}
