/**
 * RailOpt AI — Core Typed API Client
 *
 * Configurable base URL with environment variable support,
 * JWT bearer token attachment, query parameter serialization,
 * and structured error responses.
 */

import { ApiError } from "./types/api";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") || "http://localhost:8000";

let authTokenGetter: (() => string | null) | null = null;

export function setAuthTokenGetter(getter: (() => string | null) | null): void {
  authTokenGetter = getter;
}

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | null | undefined>;
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { params, headers: customHeaders, ...restOptions } = options;

  let url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        searchParams.append(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes("?") ? "&" : "?") + queryString;
    }
  }

  const headers = new Headers(customHeaders);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }
  if (!headers.has("Content-Type") && restOptions.body && typeof restOptions.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  const token = authTokenGetter ? authTokenGetter() : null;
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  try {
    const response = await fetch(url, {
      ...restOptions,
      headers,
    });

    if (!response.ok) {
      let errorBody: unknown;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = await response.text();
      }

      const message =
        typeof errorBody === "object" && errorBody !== null && "detail" in errorBody
          ? String((errorBody as { detail: unknown }).detail)
          : `API request failed with status ${response.status}`;
      const detail =
        typeof errorBody === "object" && errorBody !== null ? (errorBody as Record<string, unknown>) : undefined;

      throw new ApiError(response.status, message, detail);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    const networkError = new ApiError(
      0,
      (error as Error).message || "Network connection error"
    );
    throw networkError;
  }
}

export function apiGet<T>(endpoint: string, params?: RequestOptions["params"]): Promise<T> {
  return apiClient<T>(endpoint, { method: "GET", params });
}

export function apiPost<T>(
  endpoint: string,
  body?: unknown,
  params?: RequestOptions["params"]
): Promise<T> {
  return apiClient<T>(endpoint, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
    params,
  });
}
