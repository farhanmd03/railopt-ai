import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import LoginPage, { DEMO_ROLES } from "@/app/login/page";
import * as reactOidcContext from "react-oidc-context";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn(),
  }),
}));

vi.mock("react-oidc-context", () => ({
  useAuth: vi.fn(),
}));

describe("Login Page & 8-Role Demo Access", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, NEXT_PUBLIC_DEMO_ACCESS_ENABLED: "true" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("renders RailOpt AI brand, division, and trust statement", () => {
    vi.spyOn(reactOidcContext, "useAuth").mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      signinRedirect: vi.fn(),
      error: undefined,
    } as unknown as reactOidcContext.AuthContextProps);

    render(<LoginPage />);

    expect(screen.getAllByText(/RailOpt/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/HOWRAH/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/EASTERN RAILWAY/i).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Protected by 8-role Deny-by-Default RBAC/i)
    ).toBeInTheDocument();
  });

  it("renders standard SSO button and triggers signinRedirect on click", () => {
    const mockSigninRedirect = vi.fn();
    vi.spyOn(reactOidcContext, "useAuth").mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      signinRedirect: mockSigninRedirect,
      error: undefined,
    } as unknown as reactOidcContext.AuthContextProps);

    render(<LoginPage />);

    const signInBtn = screen.getByRole("button", { name: /continue with railway sso/i });
    expect(signInBtn).toBeInTheDocument();

    fireEvent.click(signInBtn);
    expect(mockSigninRedirect).toHaveBeenCalledTimes(1);
  });

  it("renders Demo Access section when NEXT_PUBLIC_DEMO_ACCESS_ENABLED is true", () => {
    vi.spyOn(reactOidcContext, "useAuth").mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      signinRedirect: vi.fn(),
      error: undefined,
    } as unknown as reactOidcContext.AuthContextProps);

    render(<LoginPage />);

    expect(screen.getByText(/DEMO ACCESS — SIH EVALUATION/i)).toBeInTheDocument();
    expect(screen.getByText(/Demo accounts are intended for evaluation only/i)).toBeInTheDocument();
  });

  it("renders all 8 role selectors", () => {
    vi.spyOn(reactOidcContext, "useAuth").mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      signinRedirect: vi.fn(),
      error: undefined,
    } as unknown as reactOidcContext.AuthContextProps);

    render(<LoginPage />);

    expect(DEMO_ROLES.length).toBe(8);
    for (const roleInfo of DEMO_ROLES) {
      expect(screen.getByRole("button", { name: roleInfo.label })).toBeInTheDocument();
    }
  });

  it("selecting PLANNER populates planner.demo username", () => {
    vi.spyOn(reactOidcContext, "useAuth").mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      signinRedirect: vi.fn(),
      error: undefined,
    } as unknown as reactOidcContext.AuthContextProps);

    render(<LoginPage />);

    const plannerBtn = screen.getByRole("button", { name: "Planner" });
    fireEvent.click(plannerBtn);

    expect(screen.getByText("planner.demo")).toBeInTheDocument();
    expect(screen.getByText(/Planning and optimization workflow/i)).toBeInTheDocument();
  });

  it("selecting APPROVER populates approver.demo username", () => {
    vi.spyOn(reactOidcContext, "useAuth").mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      signinRedirect: vi.fn(),
      error: undefined,
    } as unknown as reactOidcContext.AuthContextProps);

    render(<LoginPage />);

    const approverBtn = screen.getByRole("button", { name: "Approver" });
    fireEvent.click(approverBtn);

    expect(screen.getByText("approver.demo")).toBeInTheDocument();
    expect(screen.getByText(/Plan review and approval authority/i)).toBeInTheDocument();
  });

  it("selecting each remaining role updates username correctly", () => {
    vi.spyOn(reactOidcContext, "useAuth").mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      signinRedirect: vi.fn(),
      error: undefined,
    } as unknown as reactOidcContext.AuthContextProps);

    render(<LoginPage />);

    for (const roleInfo of DEMO_ROLES) {
      const btn = screen.getByRole("button", { name: roleInfo.label });
      fireEvent.click(btn);
      expect(screen.getByText(roleInfo.username)).toBeInTheDocument();
    }
  });

  it("password remains masked and no real password is embedded in the DOM", () => {
    vi.spyOn(reactOidcContext, "useAuth").mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      signinRedirect: vi.fn(),
      error: undefined,
    } as unknown as reactOidcContext.AuthContextProps);

    const { container } = render(<LoginPage />);

    expect(screen.getByText("••••••••••••••")).toBeInTheDocument();
    // Confirm no raw demo password is in DOM
    expect(container.textContent).not.toMatch(/railopt_demo_2026/);
  });

  it("clicking Enter Demo Workspace acquires demo token and stores demo session", async () => {
    vi.spyOn(reactOidcContext, "useAuth").mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      signinRedirect: vi.fn(),
      error: undefined,
    } as unknown as reactOidcContext.AuthContextProps);

    // Mock apiClient and setDemoUserSession
    const authConfig = await import("@/lib/auth-config");
    const setDemoSessionSpy = vi.spyOn(authConfig, "setDemoUserSession").mockResolvedValue({} as any);

    const apiClientModule = await import("@/lib/api-client");
    const apiClientSpy = vi.spyOn(apiClientModule, "apiClient").mockResolvedValue({
      access_token: "mock-demo-jwt",
      token_type: "Bearer",
      expires_in: 28800,
      user: {
        sub: "demo|planner",
        preferred_username: "planner.demo",
        name: "Planner User",
        email: "planner.demo@railopt.local",
        roles: ["PLANNER"],
      },
    });

    render(<LoginPage />);

    const plannerBtn = screen.getByRole("button", { name: "Planner" });
    fireEvent.click(plannerBtn);

    const enterBtn = screen.getByRole("button", { name: /Enter Demo Workspace as Planner/i });
    expect(enterBtn).toBeInTheDocument();

    fireEvent.click(enterBtn);

    expect(apiClientSpy).toHaveBeenCalledWith("/api/v1/auth/demo-token", {
      method: "POST",
      body: JSON.stringify({ role: "PLANNER" }),
    });
  });

  it("hides Demo Access section when NEXT_PUBLIC_DEMO_ACCESS_ENABLED is false", () => {
    process.env = { ...originalEnv, NEXT_PUBLIC_DEMO_ACCESS_ENABLED: "false" };

    vi.spyOn(reactOidcContext, "useAuth").mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      signinRedirect: vi.fn(),
      error: undefined,
    } as unknown as reactOidcContext.AuthContextProps);

    render(<LoginPage />);

    expect(screen.queryByText(/DEMO ACCESS — SIH EVALUATION/i)).toBeNull();
    expect(screen.getByRole("button", { name: /continue with railway sso/i })).toBeInTheDocument();
  });

  it("renders authentication error if sign in failed", () => {
    vi.spyOn(reactOidcContext, "useAuth").mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      signinRedirect: vi.fn(),
      error: new Error("Keycloak server unreachable"),
    } as unknown as reactOidcContext.AuthContextProps);

    render(<LoginPage />);

    expect(screen.getByText("Authentication Error")).toBeInTheDocument();
    expect(screen.getByText("Keycloak server unreachable")).toBeInTheDocument();
  });
});
