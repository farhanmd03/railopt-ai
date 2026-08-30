import { apiGet, apiPost } from "../api-client";
import { PaginatedResponse } from "../types/api";
import {
  OptimizationRun,
  OptimizationRunCreateRequest,
  OptimizationRunDetail,
  OptimizedBlock,
} from "../types/optimization";

export interface ListOptimizationRunsParams {
  page?: number;
  page_size?: number;
  status?: string;
  solver_status?: string;
}

export function getOptimizationRuns(
  params?: ListOptimizationRunsParams
): Promise<PaginatedResponse<OptimizationRun>> {
  return apiGet<PaginatedResponse<OptimizationRun>>(
    "/api/v1/optimization/runs",
    params as Record<string, string | number | boolean>
  );
}

export function getOptimizationRun(runId: string | number): Promise<OptimizationRunDetail> {
  return apiGet<OptimizationRunDetail>(`/api/v1/optimization/runs/${encodeURIComponent(String(runId))}`);
}

export interface ListOptimizedBlocksParams {
  page?: number;
  page_size?: number;
  section_id?: string;
  is_integrated?: boolean;
}

export function getOptimizedBlocks(
  runId: string | number,
  params?: ListOptimizedBlocksParams
): Promise<PaginatedResponse<OptimizedBlock>> {
  return apiGet<PaginatedResponse<OptimizedBlock>>(
    `/api/v1/optimization/runs/${encodeURIComponent(String(runId))}/blocks`,
    params as Record<string, string | number | boolean>
  );
}

export function createOptimizationRun(
  request: OptimizationRunCreateRequest
): Promise<OptimizationRun> {
  return apiPost<OptimizationRun>("/api/v1/optimization/runs", request);
}
