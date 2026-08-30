import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Sidebar } from "@/components/layout/sidebar";
import * as reactOidcContext from "react-oidc-context";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

vi.mock("react-oidc-context", () => ({
  useAuth: vi.fn(),
}));

describe("Role-Aware Navigation Visibility", () => {
  it("renders all 8 navigation items for ADMIN role", () => {
    vi.spyOn(reactOidcContext, "useAuth").mockReturnValue({
      isAuthenticated: true,
      user: {
        profile: {
          sub: "admin-1",
          realm_access: {
            roles: ["ADMIN"],
          },
        },
      },
    } as unknown as reactOidcContext.AuthContextProps);

    render(<Sidebar />);

    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /maintenance/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /planning/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /optimization/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /operations/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /map/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /approvals/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /audit/i })).toBeInTheDocument();
  });

  it("restricts VIEWER role to Dashboard, Map, and Audit", () => {
    vi.spyOn(reactOidcContext, "useAuth").mockReturnValue({
      isAuthenticated: true,
      user: {
        profile: {
          sub: "viewer-1",
          realm_access: {
            roles: ["VIEWER"],
          },
        },
      },
    } as unknown as reactOidcContext.AuthContextProps);

    render(<Sidebar />);

    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /map/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /audit/i })).toBeInTheDocument();

    expect(screen.queryByRole("link", { name: /maintenance/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /planning/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /optimization/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /approvals/i })).toBeNull();
  });

  it("restricts ENGINEERING role to Dashboard, Maintenance, Operations, Map", () => {
    vi.spyOn(reactOidcContext, "useAuth").mockReturnValue({
      isAuthenticated: true,
      user: {
        profile: {
          sub: "eng-1",
          realm_access: {
            roles: ["ENGINEERING"],
          },
        },
      },
    } as unknown as reactOidcContext.AuthContextProps);

    render(<Sidebar />);

    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /maintenance/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /operations/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /map/i })).toBeInTheDocument();

    expect(screen.queryByRole("link", { name: /planning/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /optimization/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /approvals/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /audit/i })).toBeNull();
  });

  it("renders no protected navigation items when user has no recognized roles", () => {
    vi.spyOn(reactOidcContext, "useAuth").mockReturnValue({
      isAuthenticated: true,
      user: {
        profile: {
          sub: "unknown-1",
          realm_access: {
            roles: ["SOME_UNKNOWN_ROLE"],
          },
        },
      },
    } as unknown as reactOidcContext.AuthContextProps);

    render(<Sidebar />);

    expect(screen.queryByRole("link", { name: /dashboard/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /maintenance/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /planning/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /optimization/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /operations/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /map/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /approvals/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /audit/i })).toBeNull();
  });
});
