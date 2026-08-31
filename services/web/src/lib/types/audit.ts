export interface AuditLog {
  id: number;
  timestamp: string;
  user_id: string | null;
  action: "SUBMITTED" | "APPROVED" | "REJECTED" | string;
  entity_type: string | null;
  entity_id: string | null;
  before_value: string | null;
  after_value: string | null;
  details: string | null;
  ip_address: string | null;
}

export interface AuditLogListResponse {
  items: AuditLog[];
  total: number;
}
