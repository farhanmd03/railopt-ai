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

  it("opens user menu, opens confirmation dialog, and executes signout on confirm", () => {
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

    // Sign out menu item should appear
    const signOutMenuItem = screen.getByRole("button", { name: /sign out of railopt/i });
    expect(signOutMenuItem).toBeInTheDocument();

    // Clicking menu item opens confirmation dialog without immediate logout
    fireEvent.click(signOutMenuItem);
    expect(screen.getByText("Sign out of RailOpt AI?")).toBeInTheDocument();
    expect(mockSignoutRedirect).not.toHaveBeenCalled();

    // Confirm signout in modal
    const confirmBtn = screen.getByRole("button", { name: /^sign out$/i });
    fireEvent.click(confirmBtn);
    expect(mockSignoutRedirect).toHaveBeenCalledTimes(1);
  });

  it("dismisses logout dialog without signout when Cancel is clicked", () => {
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

    const profileBtn = screen.getByRole("button", { name: /planner demo/i });
    fireEvent.click(profileBtn);

    const signOutMenuItem = screen.getByRole("button", { name: /sign out of railopt/i });
    fireEvent.click(signOutMenuItem);

    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelBtn);

    expect(screen.queryByText("Sign out of RailOpt AI?")).not.toBeInTheDocument();
    expect(mockSignoutRedirect).not.toHaveBeenCalled();
  });

  it("does NOT display VIEWER when user has no roles assigned", () => {
    vi.spyOn(reactOidcContext, "useAuth").mockReturnValue({
      isAuthenticated: true,
      user: {
        profile: {
          sub: "user-empty",
          preferred_username: "noroles.demo",
          given_name: "NoRole",
          family_name: "User",
          realm_access: {
            roles: [],
          },
        },
      },
      signoutRedirect: vi.fn(),
      removeUser: vi.fn(),
    } as unknown as reactOidcContext.AuthContextProps);

    render(<Header />);

    // Must show user name and 'No application role', and NOT 'VIEWER'
    expect(screen.getByText("NoRole User")).toBeInTheDocument();
    expect(screen.getByText("No application role")).toBeInTheDocument();
    expect(screen.queryByText("VIEWER")).not.toBeInTheDocument();
  });

  it("displays VIEWER when user genuinely has VIEWER role assigned", () => {
    vi.spyOn(reactOidcContext, "useAuth").mockReturnValue({
      isAuthenticated: true,
      user: {
        profile: {
          sub: "user-viewer",
          preferred_username: "viewer.demo",
          given_name: "Guest",
          family_name: "Viewer",
          realm_access: {
            roles: ["VIEWER"],
          },
        },
      },
      signoutRedirect: vi.fn(),
      removeUser: vi.fn(),
    } as unknown as reactOidcContext.AuthContextProps);

    render(<Header />);

    expect(screen.getByText("Guest Viewer")).toBeInTheDocument();
    expect(screen.getByText("VIEWER")).toBeInTheDocument();
  });
});
