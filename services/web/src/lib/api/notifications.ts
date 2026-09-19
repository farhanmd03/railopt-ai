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

export function markNotificationRead(id: number): Promise<Notification> {
  return apiClient<Notification>(`/api/v1/notifications/${id}/read`, {
    method: "PATCH",
  });
}

export function markAllNotificationsRead(): Promise<{ message: string }> {
  return apiClient<{ message: string }>("/api/v1/notifications/read-all", {
    method: "PATCH",
  });
}
