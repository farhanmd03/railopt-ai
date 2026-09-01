import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiClient, apiGet, apiPost, setAuthTokenGetter } from "@/lib/api-client";

describe("API Client", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    setAuthTokenGetter(null);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("constructs full URL with path and query parameters", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [], total: 0 }),
    });
    global.fetch = mockFetch;

    await apiGet("/api/v1/sections", { page: 1, page_size: 10 });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain("/api/v1/sections");
    expect(calledUrl).toContain("page=1");
    expect(calledUrl).toContain("page_size=10");
  });

  it("attaches Authorization header when token getter is configured", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "ok" }),
    });
    global.fetch = mockFetch;

    setAuthTokenGetter(() => "demo-jwt-token-xyz");

    await apiGet("/api/v1/health");

    const calledHeaders = mockFetch.mock.calls[0][1].headers;
    expect(calledHeaders.get("Authorization")).toBe("Bearer demo-jwt-token-xyz");
  });

  it("handles HTTP errors and throws structured ApiError", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ detail: "Insufficient role privileges" }),
    });
    global.fetch = mockFetch;

    await expect(apiGet("/api/v1/optimization/runs")).rejects.toMatchObject({
      status: 403,
      message: "Insufficient role privileges",
      detail: { detail: "Insufficient role privileges" },
    });
  });

  it("sends JSON body on POST requests", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 1, run_id: "RUN-001" }),
    });
    global.fetch = mockFetch;

    const payload = { run_type: "standard", solver_time_limit_seconds: 10 };
    await apiPost("/api/v1/optimization/runs", payload);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const options = mockFetch.mock.calls[0][1];
    expect(options.method).toBe("POST");
    expect(options.body).toBe(JSON.stringify(payload));
  });
});
