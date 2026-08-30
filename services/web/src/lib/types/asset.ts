export interface Asset {
  asset_id: string;
  section_id: string | null;
  station_code: string | null;
  department: string;
  asset_type: string;
  failure_risk_score: number | null;
  criticality_index: number | null;
  last_maintained_date: string | null;
  source_type: string | null;
}
