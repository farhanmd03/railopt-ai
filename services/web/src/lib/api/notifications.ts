import { apiGet, apiClient } from "../api-client";
import { Notification, NotificationListResponse } from "../types/notifications";

export interface ListNotificationsParams {
  limit?: number;
}

export function getNotifications(
  params?: ListNotificationsParams,
): Promise<NotificationListResponse> {
  return apiGet<NotificationListResponse>(
    "/api/v1/notifications",
    params as Record<string, string | number>,
  );
}

export async function markNotificationRead(id: number): Promise<Notification> {
  const response = await apiClient.patch(`/api/v1/notifications/${id}/read`);
  return response.data;
}

export async function markAllNotificationsRead(): Promise<{ message: string }> {
  const response = await apiClient.patch("/api/v1/notifications/read-all");
  return response.data;
}
