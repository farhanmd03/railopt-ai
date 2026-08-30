import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Sidebar, NAV_ITEMS } from "@/components/layout/sidebar";
import * as reactOidcContext from "react-oidc-context";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

vi.mock("react-oidc-context", () => ({
  useAuth: vi.fn(),
}));

describe("Sidebar Navigation", () => {
  it("renders the RailOpt AI brand and Howrah division label", () => {
    vi.spyOn(reactOidcContext, "useAuth").mockReturnValue({
      isAuthenticated: true,
      user: { profile: { realm_access: { roles: ["ADMIN"] } } },
    } as unknown as reactOidcContext.AuthContextProps);

    render(<Sidebar />);
    expect(screen.getByText("RailOpt AI")).toBeInTheDocument();
    expect(screen.getByText("Howrah Division (ER)")).toBeInTheDocument();
  });

  it("renders all 8 required operational module links for admin", () => {
    vi.spyOn(reactOidcContext, "useAuth").mockReturnValue({
      isAuthenticated: true,
      user: { profile: { realm_access: { roles: ["ADMIN"] } } },
    } as unknown as reactOidcContext.AuthContextProps);

    render(<Sidebar />);
    expect(NAV_ITEMS).toHaveLength(8);

    for (const item of NAV_ITEMS) {
      const link = screen.getByRole("link", { name: new RegExp(item.label, "i") });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", item.href);
    }
  });

  it("marks the active link with aria-current", () => {
    vi.spyOn(reactOidcContext, "useAuth").mockReturnValue({
      isAuthenticated: true,
      user: { profile: { realm_access: { roles: ["ADMIN"] } } },
    } as unknown as reactOidcContext.AuthContextProps);

    render(<Sidebar />);
    const activeLink = screen.getByRole("link", { name: /dashboard/i });
    expect(activeLink).toHaveAttribute("aria-current", "page");
  });
});
