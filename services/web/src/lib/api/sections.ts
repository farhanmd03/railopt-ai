import { apiGet } from "../api-client";
import { PaginatedResponse } from "../types/api";
import { Section } from "../types/section";

export interface ListSectionsParams {
  page?: number;
  page_size?: number;
  electrified?: boolean;
  line_type?: string;
}

export function getSections(params?: ListSectionsParams): Promise<PaginatedResponse<Section>> {
  return apiGet<PaginatedResponse<Section>>("/api/v1/sections", params as Record<string, string | number | boolean>);
}

export function getSection(sectionId: string): Promise<Section> {
  return apiGet<Section>(`/api/v1/sections/${encodeURIComponent(sectionId)}`);
}
