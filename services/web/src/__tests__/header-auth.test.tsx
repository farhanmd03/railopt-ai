import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Header } from "@/components/layout/header";
import * as reactOidcContext from "react-oidc-context";

vi.mock("react-oidc-context", () => ({
  useAuth: vi.fn(),
}));

describe("Header Authentication & User Display", () => {
  it("renders authenticated user name and primary role badge", () => {
    vi.spyOn(reactOidcContext, "useAuth").mockReturnValue({
      isAuthenticated: true,
      user: {
        profile: {
          sub: "user-1",
          preferred_username: "planner.demo",
          given_name: "Planner",
          family_name: "Demo",
          realm_access: {
            roles: ["PLANNER"],
          },
        },
      },
      signoutRedirect: vi.fn(),
      removeUser: vi.fn(),
    } as unknown as reactOidcContext.AuthContextProps);

    render(<Header />);

    expect(screen.getByText("Planner Demo")).toBeInTheDocument();
    expect(screen.getByText("PLANNER")).toBeInTheDocument();
  });

  it("opens user menu and executes signout on Sign out click", () => {
    const mockSignoutRedirect = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(reactOidcContext, "useAuth").mockReturnValue({
      isAuthenticated: true,
      user: {
        profile: {
          sub: "user-1",
          preferred_username: "planner.demo",
          given_name: "Planner",
          family_name: "Demo",
          email: "planner.demo@railopt.local",
          realm_access: {
            roles: ["PLANNER"],
          },
        },
      },
      signoutRedirect: mockSignoutRedirect,
      removeUser: vi.fn(),
    } as unknown as reactOidcContext.AuthContextProps);

    render(<Header />);

    // Click profile button to open menu
    const profileBtn = screen.getByRole("button", { name: /planner demo/i });
    fireEvent.click(profileBtn);

    // Sign out button should appear
    const signOutBtn = screen.getByRole("button", { name: /sign out of railopt/i });
    expect(signOutBtn).toBeInTheDocument();

    fireEvent.click(signOutBtn);
    expect(mockSignoutRedirect).toHaveBeenCalledTimes(1);
  });
});
