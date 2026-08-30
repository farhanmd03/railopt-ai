export interface Section {
  section_id: string;
  section_name: string;
  from_station_code: string | null;
  to_station_code: string | null;
  route_km: number | null;
  track_count: number | null;
  line_type: string | null;
  electrified: boolean | null;
  signalling_system: string | null;
  division_id: number | null;
  source_type: string | null;
}
