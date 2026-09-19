import { apiGet, apiPost } from "../api-client";
import { PaginatedResponse } from "../types/api";
import {
  AdjustmentCategory,
  AdjustmentPayload,
  NegotiationAction,
  NegotiationLog,
  NegotiationRequest,
  OptimizationRun,
  OptimizationRunCreateRequest,
  OptimizationRunDetail,
  OptimizedBlock,
} from "../types/optimization";

export type {
  AdjustmentCategory,
  AdjustmentPayload,
  NegotiationAction,
  NegotiationLog,
  NegotiationRequest,
};

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

export function submitOptimizationRun(runId: string | number): Promise<OptimizationRun> {
  return apiPost<OptimizationRun>(`/api/v1/optimization/runs/${encodeURIComponent(String(runId))}/submit`, {});
}

export function approveOptimizationRun(runId: string | number): Promise<OptimizationRun> {
  return apiPost<OptimizationRun>(`/api/v1/optimization/runs/${encodeURIComponent(String(runId))}/approve`, {});
}

export function rejectOptimizationRun(
  runId: string | number,
  reason: string
): Promise<OptimizationRun> {
  return apiPost<OptimizationRun>(`/api/v1/optimization/runs/${encodeURIComponent(String(runId))}/reject`, {
    reason,
  });
}

export interface AuditLogListResponse {
  items: import("../types/audit").AuditLog[];
  total: number;
}

export function getOptimizationRunAuditTrail(
  runId: string | number
): Promise<AuditLogListResponse> {
  return apiGet<AuditLogListResponse>(
    `/api/v1/audit/optimization-runs/${encodeURIComponent(String(runId))}`
  );
}
export interface ReadinessCheck {
  key: string;
  label: string;
  status: "PASS" | "PENDING" | "FAIL";
  message: string;
}

export interface PossessionReadiness {
  block_id: number;
  readiness: "GO" | "HOLD" | "REDUCE";
  summary: string;
  checks: ReadinessCheck[];
  human_decision_required: boolean;
}

export function getBlockReadiness(
  blockId: number
): Promise<PossessionReadiness> {
  return apiGet<PossessionReadiness>(
    `/api/v1/optimization/blocks/${encodeURIComponent(String(blockId))}/readiness`
  );
}

export function negotiateBlock(
  blockId: number,
  request: NegotiationRequest
): Promise<NegotiationLog> {
  return apiPost<NegotiationLog>(
    `/api/v1/optimization/blocks/${encodeURIComponent(String(blockId))}/negotiate`,
    request
  );
}

export function getBlockNegotiations(
  blockId: number
): Promise<NegotiationLog[]> {
  return apiGet<NegotiationLog[]>(
    `/api/v1/optimization/blocks/${encodeURIComponent(String(blockId))}/negotiations`
  );
}

export function getBlockMessages(
  blockId: number
): Promise<import("../types/optimization").DepartmentMessage[]> {
  return apiGet<import("../types/optimization").DepartmentMessage[]>(
    `/api/v1/optimization/blocks/${encodeURIComponent(String(blockId))}/messages`
  );
}

export function sendBlockMessage(
  blockId: number,
  request: import("../types/optimization").DepartmentMessageCreateRequest
): Promise<import("../types/optimization").DepartmentMessage> {
  return apiPost<import("../types/optimization").DepartmentMessage>(
    `/api/v1/optimization/blocks/${encodeURIComponent(String(blockId))}/messages`,
    request
  );
}
