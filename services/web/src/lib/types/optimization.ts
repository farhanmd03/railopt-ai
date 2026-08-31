export interface OptimizationRunCreateRequest {
  planning_start?: string | null;
  planning_end?: string | null;
  run_type?: string;
  solver_time_limit_seconds?: number;
  allow_train_conflicts?: boolean;
  require_resource_feasibility?: boolean;
  max_block_duration_hrs?: number;
  weight_priority_score?: number | null;
  weight_integrated_task_bonus?: number | null;
  weight_tasks_scheduled?: number | null;
  weight_overdue_mitigation?: number | null;
  weight_train_disruption?: number | null;
  weight_freight_impact?: number | null;
  weight_unused_window_time?: number | null;
  weight_total_block_count?: number | null;
}

export interface OptimizedBlock {
  id: number;
  optimization_run_id: number;
  optimized_block_id: string;
  candidate_id: string | null;
  section_id: string;
  block_start: string;
  block_end: string;
  block_duration_hrs: number;
  block_type: "single" | "integrated" | string;
  is_integrated: boolean;
  departments_involved: string[];
  realized_priority_value: number;
  candidate_priority_value: number | null;
  train_conflicts: number;
  estimated_impact_score: number | null;
  resource_status: string | null;
  freight_impact: string | null;
  task_ids: string[];
  status: "Candidate" | "Approved" | "Rejected" | string;
  explanation: Record<string, unknown> | null;
  created_at: string | null;
}

export interface OptimizationRun {
  id: number;
  run_id: string;
  run_type: string | null;
  planning_horizon_start: string | null;
  planning_horizon_end: string | null;
  status: "Completed" | "Failed" | string;
  solver_status: "OPTIMAL" | "FEASIBLE" | "INFEASIBLE" | "UNKNOWN" | string;
  objective_value: number | null;
  solve_time_seconds: number | null;
  tasks_considered: number;
  tasks_scheduled: number;
  tasks_unassigned: number;
  integrated_block_count: number;
  separate_block_count: number;
  estimated_total_block_hours: number;
  unassigned_task_ids: string[];
  warnings: string[];
  notes: string | null;
  approval_status?: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | string;
  submitted_by?: string | null;
  submitted_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  rejected_by?: string | null;
  rejected_at?: string | null;
  rejection_reason?: string | null;
  created_at: string | null;
}

export interface OptimizationRunDetail extends OptimizationRun {
  scheduled_blocks: OptimizedBlock[];
}
