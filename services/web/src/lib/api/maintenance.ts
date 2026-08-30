import { apiGet } from "../api-client";
import { PaginatedResponse } from "../types/api";
import {
  IntegrationOpportunity,
  MaintenanceTask,
  PriorityAssessment,
} from "../types/maintenance";

export interface ListMaintenanceTasksParams {
  page?: number;
  page_size?: number;
  department?: string;
  severity?: string;
  status?: string;
  section_id?: string;
}

export function getMaintenanceTasks(
  params?: ListMaintenanceTasksParams
): Promise<PaginatedResponse<MaintenanceTask>> {
  return apiGet<PaginatedResponse<MaintenanceTask>>(
    "/api/v1/maintenance-tasks",
    params as Record<string, string | number | boolean>
  );
}

export function getMaintenanceTask(taskId: string): Promise<MaintenanceTask> {
  return apiGet<MaintenanceTask>(`/api/v1/maintenance-tasks/${encodeURIComponent(taskId)}`);
}

export function getTaskPriority(taskId: string): Promise<PriorityAssessment> {
  return apiGet<PriorityAssessment>(
    `/api/v1/maintenance-tasks/${encodeURIComponent(taskId)}/priority`
  );
}

export interface ListIntegrationOpportunitiesParams {
  page?: number;
  page_size?: number;
  section_id?: string;
  cross_department?: boolean;
}

export function getIntegrationOpportunities(
  params?: ListIntegrationOpportunitiesParams
): Promise<PaginatedResponse<IntegrationOpportunity>> {
  return apiGet<PaginatedResponse<IntegrationOpportunity>>(
    "/api/v1/maintenance-tasks/integration-opportunities",
    params as Record<string, string | number | boolean>
  );
}
