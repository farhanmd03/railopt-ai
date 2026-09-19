export type PossessionOutcomeStatus =
  | "PLANNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "DELAYED";

export interface PossessionOutcome {
  id: number;
  optimized_block_id: number;
  planned_start: string;
  planned_end: string;
  actual_start: string | null;
  actual_end: string | null;
  status: PossessionOutcomeStatus;
  delay_minutes: number | null;
  cancellation_reason: string | null;
  affected_departments: string[] | null;
  planned_impact_score: number | null;
  actual_impact_score: number | null;
  notes: string | null;
  recorded_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface PossessionOutcomeCreateRequest {
  planned_start: string;
  planned_end: string;
  actual_start?: string | null;
  actual_end?: string | null;
  status?: string;
  delay_minutes?: number | null;
  cancellation_reason?: string | null;
  affected_departments?: string[] | null;
  planned_impact_score?: number | null;
  actual_impact_score?: number | null;
  notes?: string | null;
}

export interface PossessionOutcomeUpdateRequest {
  actual_start?: string | null;
  actual_end?: string | null;
  status?: string | null;
  delay_minutes?: number | null;
  cancellation_reason?: string | null;
  actual_impact_score?: number | null;
  notes?: string | null;
}

/**
 * Source/data provenance mapping for Indian Railways departments.
 * Explicitly distinguishes prototype / synthetic data adapters from production live feeds.
 */
export const SOURCE_BADGES: Record<
  string,
  { source: string; label: string; isPrototype: boolean }
> = {
  Engineering: {
    source: "TMS",
    label: "Track Management System",
    isPrototype: true,
  },
  "S&T": {
    source: "SMMS",
    label: "Signal Maintenance Management System",
    isPrototype: true,
  },
  TRD: {
    source: "TDMS",
    label: "Traction Distribution Management System",
    isPrototype: true,
  },
  Timetable: {
    source: "COA",
    label: "Control Office Application",
    isPrototype: true,
  },
};
