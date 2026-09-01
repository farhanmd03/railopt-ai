import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExplainButton } from "@/components/explainability/explain-button";
import { ExplanationDrawer } from "@/components/explainability/explanation-drawer";
import * as explanationsApi from "@/lib/api/explanations";
import { ExplanationResponse } from "@/lib/types/explanation";

const mockExplanation: ExplanationResponse = {
  explanation_type: "RUN_SUMMARY",
  summary: "Optimization Run #42 scheduled 45 tasks yielding 18 possession blocks with an objective value of 7500.5.",
  key_factors: [
    "Solver achieved global optimality via CP-SAT.",
    "12 cross-department integrated blocks generated across Engineering and TRD.",
  ],
  limitations: [
    "5 low-priority tasks remained unassigned due to section maintenance window limits.",
  ],
  confidence_note: "Grounded strictly in deterministic solver outputs without scheduling authority.",
  deterministic_facts: {
    run_id: 42,
    solver_status: "OPTIMAL",
    tasks_scheduled: 45,
    total_blocks: 18,
    integrated_blocks: 12,
  },
  model_name: "gemma2:2b (Local Ollama)",
  disclaimer: "AI-generated explanation based on deterministic system outputs. The explanation does not make scheduling, safety, or approval decisions.",
  generated_at: "2026-09-01T10:00:00Z",
};

describe("Ollama-Powered Explainability Layer UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders ExplainButton with label and icon", () => {
    render(
      <ExplainButton
        request={{ explanation_type: "RUN_SUMMARY", run_id: 42 }}
        label="Explain Result"
      />
    );

    expect(screen.getByRole("button", { name: /Explain Result/i })).toBeInTheDocument();
  });

  it("opens drawer and displays loaded explanation content", async () => {
    vi.spyOn(explanationsApi, "generateExplanation").mockResolvedValueOnce(mockExplanation);

    render(
      <ExplainButton
        request={{ explanation_type: "RUN_SUMMARY", run_id: 42 }}
        label="Explain Result"
      />
    );

    const btn = screen.getByRole("button", { name: /Explain Result/i });
    fireEvent.click(btn);

    // Verify loading or drawer open
    expect(await screen.findByText(/Optimization Run Summary Explanation/i)).toBeInTheDocument();

    // Verify summary, key factors, limitations, facts, and disclaimer
    expect(
      await screen.findByText(/Optimization Run #42 scheduled 45 tasks/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Solver achieved global optimality via CP-SAT/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/5 low-priority tasks remained unassigned/i)
    ).toBeInTheDocument();

    // Authoritative facts table
    expect(screen.getByText("Tasks Scheduled")).toBeInTheDocument();
    expect(screen.getByText("45")).toBeInTheDocument();

    // Advisory disclaimer
    expect(
      screen.getByText(/The explanation does not make scheduling, safety, or approval decisions/i)
    ).toBeInTheDocument();
  });

  it("renders service unavailable error state with retry button when Ollama is offline", async () => {
    vi.spyOn(explanationsApi, "generateExplanation").mockRejectedValueOnce({
      response: {
        data: {
          detail: "Local explanation service unavailable. Please check that Ollama is running.",
        },
      },
    });

    render(
      <ExplainButton
        request={{ explanation_type: "BLOCK_EXPLANATION", run_id: 42, block_id: 101 }}
        label="Explain Block"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Explain Block/i }));

    expect(
      await screen.findByRole("heading", { name: /Explanation Service Unavailable/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Retry Explanation/i })
    ).toBeInTheDocument();
  });

  it("closes drawer when Close Panel button is clicked", async () => {
    const onClose = vi.fn();
    render(
      <ExplanationDrawer
        isOpen={true}
        onClose={onClose}
        request={{ explanation_type: "RUN_SUMMARY", run_id: 42 }}
        explanation={mockExplanation}
        isLoading={false}
        error={null}
        onRetry={vi.fn()}
      />
    );

    const closeBtn = screen.getByRole("button", { name: /Close Panel/i });
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
