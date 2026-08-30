import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AppShell } from "@/components/layout/app-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

describe("AppShell Layout", () => {
  it("renders desktop sidebar, top header, and child content", () => {
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
