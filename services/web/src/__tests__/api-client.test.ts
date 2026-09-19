import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiClient, apiGet, apiPost, getApiBaseUrl, setAuthTokenGetter } from "@/lib/api-client";

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

  describe("getApiBaseUrl", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
      delete process.env.NEXT_PUBLIC_API_URL;
      delete process.env.INTERNAL_API_URL;
      delete process.env.BACKEND_URL;
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("always returns empty string in browser context, even when NEXT_PUBLIC_API_BASE_URL is set", () => {
      process.env.NEXT_PUBLIC_API_BASE_URL = "https://custom-api.railopt.ai/";
      // In jsdom environment, window is defined
      expect(typeof window).not.toBe("undefined");
      expect(getApiBaseUrl()).toBe("");
    });

    it("returns empty string in browser context when env is absent", () => {
      expect(typeof window).not.toBe("undefined");
      expect(getApiBaseUrl()).toBe("");
    });

    it("returns explicit public environment variable when in server-side context", () => {
      const originalWindow = global.window;
      try {
        // @ts-expect-error - simulating server context
        delete global.window;
        process.env.NEXT_PUBLIC_API_BASE_URL = "https://custom-api.railopt.ai/";
        expect(getApiBaseUrl()).toBe("https://custom-api.railopt.ai");
      } finally {
        global.window = originalWindow;
      }
    });

    it("returns localhost:8000 in server-side development mode without public env", () => {
      const originalWindow = global.window;
      try {
        // @ts-expect-error - simulating server context
        delete global.window;
        (process.env as Record<string, string | undefined>).NODE_ENV = "development";
        expect(getApiBaseUrl()).toBe("http://localhost:8000");
      } finally {
        global.window = originalWindow;
      }
    });

    it("returns production Render fallback in server-side production mode", () => {
      const originalWindow = global.window;
      try {
        // @ts-expect-error - simulating server context
        delete global.window;
        (process.env as Record<string, string | undefined>).NODE_ENV = "production";
        expect(getApiBaseUrl()).toBe("https://railopt-ai-36j3.onrender.com");
      } finally {
        global.window = originalWindow;
      }
    });
  });
});
