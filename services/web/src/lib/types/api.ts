/**
 * Common API pagination and response envelope types.
 */

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ApiError {
  status: number;
  message: string;
  detail?: string | Record<string, unknown>;
}
