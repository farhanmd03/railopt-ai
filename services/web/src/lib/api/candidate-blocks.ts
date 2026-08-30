import { apiGet } from "../api-client";
import { PaginatedResponse } from "../types/api";
import { CandidateBlock } from "../types/candidate-block";

export interface ListCandidateBlocksParams {
  page?: number;
  page_size?: number;
  section_id?: string;
  opportunity_id?: string;
  task_id?: string;
  date?: string;
  feasibility_status?: string;
}

export function getCandidateBlocks(
  params?: ListCandidateBlocksParams
): Promise<PaginatedResponse<CandidateBlock>> {
  return apiGet<PaginatedResponse<CandidateBlock>>(
    "/api/v1/candidate-blocks",
    params as Record<string, string | number | boolean>
  );
}

export function getCandidateBlock(candidateId: string): Promise<CandidateBlock> {
  return apiGet<CandidateBlock>(
    `/api/v1/candidate-blocks/${encodeURIComponent(candidateId)}`
  );
}
