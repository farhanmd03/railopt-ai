import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import LoginPage from "@/app/login/page";
import * as reactOidcContext from "react-oidc-context";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn(),
  }),
}));

vi.mock("react-oidc-context", () => ({
  useAuth: vi.fn(),
}));

describe("Login Page", () => {
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

  it("renders Sign in button and triggers signinRedirect on click", () => {
    const mockSigninRedirect = vi.fn();
    vi.spyOn(reactOidcContext, "useAuth").mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      signinRedirect: mockSigninRedirect,
      error: undefined,
    } as unknown as reactOidcContext.AuthContextProps);

    render(<LoginPage />);

    const signInBtn = screen.getByRole("button", { name: /continue with railway sso|sign in with railopt/i });
    expect(signInBtn).toBeInTheDocument();

    fireEvent.click(signInBtn);
    expect(mockSigninRedirect).toHaveBeenCalledTimes(1);
  });

  it("does NOT render password or credential collection inputs", () => {
    vi.spyOn(reactOidcContext, "useAuth").mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      signinRedirect: vi.fn(),
      error: undefined,
    } as unknown as reactOidcContext.AuthContextProps);

    const { container } = render(<LoginPage />);

    expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(container.querySelector('input[type="text"]')).toBeNull();
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
