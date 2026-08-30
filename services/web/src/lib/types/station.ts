export interface Station {
  station_code: string;
  station_name: string;
  station_type: string | null;
  block_station: boolean | null;
  ibp: boolean | null;
  flag_station: boolean | null;
  halt: boolean | null;
  platform_available: boolean | null;
  latitude: number | null;
  longitude: number | null;
  division: string | null;
  zone: string | null;
  out_of_division_station: boolean | null;
  administrative_division: string | null;
  scope_note: string | null;
  source_type: string | null;
}
