import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AppShell } from "@/components/layout/app-shell";
import * as reactOidcContext from "react-oidc-context";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({
    replace: vi.fn(),
  }),
}));

vi.mock("react-oidc-context", () => ({
  useAuth: vi.fn(),
}));

describe("AppShell Layout", () => {
  it("renders desktop sidebar, top header, and child content", () => {
    vi.spyOn(reactOidcContext, "useAuth").mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: {
        profile: {
          sub: "planner-1",
          preferred_username: "planner.demo",
          given_name: "Planner",
          family_name: "Demo",
          realm_access: {
            roles: ["PLANNER"],
          },
        },
      },
    } as unknown as reactOidcContext.AuthContextProps);

    render(
      <AppShell>
        <div data-testid="test-content">Operational Workspace Content</div>
      </AppShell>
    );

    // Sidebar
    expect(screen.getByText("RailOpt AI")).toBeInTheDocument();
    expect(screen.getByText("Howrah Division (ER)")).toBeInTheDocument();

    // Header
    expect(screen.getByText("HOWRAH DIVISION")).toBeInTheDocument();
    expect(screen.getByText("PLANNER")).toBeInTheDocument();

    // Content
    expect(screen.getByTestId("test-content")).toBeInTheDocument();
  });
});
