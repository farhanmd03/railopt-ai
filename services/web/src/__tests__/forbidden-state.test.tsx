import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ForbiddenState } from "@/components/feedback/forbidden-state";

describe("Forbidden State (403)", () => {
  it("renders 403 Forbidden badge and access restricted message", () => {
    render(
      <ForbiddenState
        userRoles={["VIEWER"]}
        requiredRoles={["ADMIN", "PLANNER"]}
        moduleName="Optimization Engine"
      />
    );

    expect(screen.getByText("403 FORBIDDEN")).toBeInTheDocument();
    expect(screen.getByText("Access Restricted")).toBeInTheDocument();
    expect(screen.getByText(/Optimization Engine/)).toBeInTheDocument();
    expect(screen.getByText("VIEWER")).toBeInTheDocument();
    expect(screen.getByText("ADMIN")).toBeInTheDocument();
    expect(screen.getByText("PLANNER")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /return to dashboard/i })).toBeInTheDocument();
  });
});
