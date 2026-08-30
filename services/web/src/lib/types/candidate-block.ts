export interface CandidateBlock {
  candidate_id: string;
  opportunity_id: string | null;
  section_id: string;
  window_id: string;
  window_start: string;
  window_end: string;
  candidate_start: string;
  candidate_end: string;
  block_duration_hrs: number;
  feasibility_status: "FEASIBLE" | "TRAIN_CONFLICT" | "DURATION_INSUFFICIENT" | string;
  train_conflicts: number;
  priority_score: number;
  estimated_impact_score: number;
  departments_involved: string[];
  task_ids: string[];
  reasons: string[];
}
