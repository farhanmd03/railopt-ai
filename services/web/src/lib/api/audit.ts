import { apiGet } from "../api-client";
import { AuditLogListResponse } from "../types/audit";

export interface ListAuditLogsParams {
  page?: number;
  page_size?: number;
  entity_type?: string;
  action?: string;
  user_id?: string;
}

export function getAuditLogs(
  params?: ListAuditLogsParams
): Promise<AuditLogListResponse> {
  return apiGet<AuditLogListResponse>(
    "/api/v1/audit/logs",
    params as Record<string, string | number | boolean>
  );
}
