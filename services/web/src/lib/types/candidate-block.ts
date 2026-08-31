export interface CandidateBlock {
  candidate_id: string;
  opportunity_id?: string | null;
  task_ids: string[];
  departments_involved: string[];
  section_id: string;
  window_id: string;
  candidate_start: string;
  candidate_end: string;
  required_duration_hrs?: number;
  window_duration_hrs?: number;
  block_duration_hrs?: number;
  computed_feasibility_status?: "FEASIBLE" | "TRAIN_CONFLICT" | "DURATION_INSUFFICIENT" | string;
  feasibility_status?: "FEASIBLE" | "TRAIN_CONFLICT" | "DURATION_INSUFFICIENT" | string;
  train_conflict?: boolean;
  train_conflict_count?: number;
  train_conflicts?: number;
  freight_level?: string | null;
  resource_check?: string;
  priority_score: number;
  compatibility_score?: number;
  candidate_score?: number;
  estimated_impact_score?: number;
  reasons: string[];
  warnings?: string[];
  advisory_note?: string;
  // Legacy aliases
  window_start?: string;
  window_end?: string;
}
