import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AppShell } from "@/components/layout/app-shell";
import * as reactOidcContext from "react-oidc-context";

const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/planning",
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

vi.mock("react-oidc-context", () => ({
  useAuth: vi.fn(),
}));

describe("AppShell Authentication Gate", () => {
  it("redirects unauthenticated user to /login", () => {
    vi.spyOn(reactOidcContext, "useAuth").mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    } as unknown as reactOidcContext.AuthContextProps);

    render(
      <AppShell>
        <div>Protected Planning Workspace</div>
      </AppShell>
    );

    expect(mockReplace).toHaveBeenCalledWith("/login");
  });

  it("renders 403 ForbiddenState when user role lacks route permission", () => {
    vi.spyOn(reactOidcContext, "useAuth").mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: {
        profile: {
          sub: "viewer-1",
          preferred_username: "viewer.demo",
          realm_access: {
            roles: ["VIEWER"],
          },
        },
      },
    } as unknown as reactOidcContext.AuthContextProps);

    render(
      <AppShell>
        <div>Protected Planning Workspace</div>
      </AppShell>
    );

    // VIEWER cannot access /planning
    expect(screen.getByText("403 FORBIDDEN")).toBeInTheDocument();
    expect(screen.getByText("Access Restricted")).toBeInTheDocument();
    expect(screen.queryByText("Protected Planning Workspace")).toBeNull();
  });

  it("renders child content when user role has route permission", () => {
    vi.spyOn(reactOidcContext, "useAuth").mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: {
        profile: {
          sub: "planner-1",
          preferred_username: "planner.demo",
          realm_access: {
            roles: ["PLANNER"],
          },
        },
      },
    } as unknown as reactOidcContext.AuthContextProps);

    render(
      <AppShell>
        <div>Protected Planning Workspace</div>
      </AppShell>
    );

    // PLANNER can access /planning
    expect(screen.getByText("Protected Planning Workspace")).toBeInTheDocument();
    expect(screen.queryByText("403 FORBIDDEN")).toBeNull();
  });
});
