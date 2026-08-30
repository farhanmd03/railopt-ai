import { apiGet } from "../api-client";
import { PaginatedResponse } from "../types/api";
import { Station } from "../types/station";

export interface ListStationsParams {
  page?: number;
  page_size?: number;
  division?: string;
  station_type?: string;
}

export function getStations(params?: ListStationsParams): Promise<PaginatedResponse<Station>> {
  return apiGet<PaginatedResponse<Station>>("/api/v1/stations", params as Record<string, string | number | boolean>);
}

export function getStation(stationCode: string): Promise<Station> {
  return apiGet<Station>(`/api/v1/stations/${encodeURIComponent(stationCode)}`);
}
