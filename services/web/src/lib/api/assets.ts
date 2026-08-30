import { apiGet } from "../api-client";
import { Asset } from "../types/asset";
import { PaginatedResponse } from "../types/api";

export interface ListAssetsParams {
  page?: number;
  page_size?: number;
  department?: string;
  section_id?: string;
  station_code?: string;
  asset_type?: string;
}

export function getAssets(params?: ListAssetsParams): Promise<PaginatedResponse<Asset>> {
  return apiGet<PaginatedResponse<Asset>>("/api/v1/assets", params as Record<string, string | number | boolean>);
}

export function getAsset(assetId: string): Promise<Asset> {
  return apiGet<Asset>(`/api/v1/assets/${encodeURIComponent(assetId)}`);
}
