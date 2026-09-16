export interface Notification {
  id: number;
  user_id: string | null;
  notification_type: string;
  title: string;
  message: string | null;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, any> | null;
  is_read: boolean;
  created_at: string | null;
  read_at: string | null;
}

export interface NotificationListResponse {
  items: Notification[];
  total: number;
  unread_count: number;
}
