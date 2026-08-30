import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";

describe("Feedback State Components", () => {
  it("renders LoadingState with custom message", () => {
    render(<LoadingState message="Fetching Howrah corridor data..." />);
    expect(screen.getByText("Fetching Howrah corridor data...")).toBeInTheDocument();
  });

  it("renders ErrorState with title, message, and working retry button", () => {
    const handleRetry = vi.fn();
    render(
      <ErrorState
        title="Optimization Server Offline"
        message="Could not reach CP-SAT solver endpoint."
        onRetry={handleRetry}
      />
    );
    expect(screen.getByText("Optimization Server Offline")).toBeInTheDocument();
    expect(screen.getByText("Could not reach CP-SAT solver endpoint.")).toBeInTheDocument();

    const retryBtn = screen.getByRole("button", { name: /retry request/i });
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it("renders EmptyState with title and description", () => {
    render(
      <EmptyState
        title="No Conflicting Trains"
        description="No timetable conflicts found in the selected corridor window."
      />
    );
    expect(screen.getByText("No Conflicting Trains")).toBeInTheDocument();
    expect(
      screen.getByText("No timetable conflicts found in the selected corridor window.")
    ).toBeInTheDocument();
  });
});
