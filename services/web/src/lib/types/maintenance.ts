export interface MaintenanceTask {
  task_id: string;
  asset_id: string | null;
  section_id: string | null;
  department: string;
  defect_type: string | null;
  severity: "Low" | "Medium" | "High" | "Critical" | string | null;
  reported_date: string | null;
  days_overdue: number | null;
  required_duration_hrs: number | null;
  postpone_penalty_cost: number | null;
  priority_score: number | null;
  status: "Open" | "InProgress" | "Completed" | "Cancelled" | string | null;
  source_type: string | null;
}

export interface PriorityComponents {
  severity_component: number;
  overdue_component: number;
  criticality_component: number;
  failure_risk_component: number;
}

export interface PriorityAssessment {
  task_id: string;
  asset_id: string | null;
  section_id: string | null;
  department: string;
  defect_type: string | null;
  severity: string;
  days_overdue: number;
  computed_priority_score: number;
  baseline_priority_score: number;
  priority_band: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  components: PriorityComponents;
  reasons: string[];
}

export interface IntegrationOpportunity {
  opportunity_id: string;
  section_id: string;
  primary_task_id: string;
  compatible_task_ids: string[];
  departments_involved: string[];
  compatibility_score: number;
  reasons: string[];
}
