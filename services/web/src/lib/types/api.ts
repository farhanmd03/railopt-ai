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

export class ApiError extends Error {
  status: number;
  detail?: string | Record<string, unknown>;

  constructor(status: number, message: string, detail?: string | Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}
