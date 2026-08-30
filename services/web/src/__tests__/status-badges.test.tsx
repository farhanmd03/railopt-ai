import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { SeverityBadge } from "@/components/status/severity-badge";
import { FeasibilityBadge } from "@/components/status/feasibility-badge";
import { SolverStatusBadge } from "@/components/status/solver-status-badge";
import { ApprovalBadge } from "@/components/status/approval-badge";

describe("Status Badge System", () => {
  describe("SeverityBadge", () => {
    it("renders Critical severity with distinct text", () => {
      render(<SeverityBadge severity="Critical" />);
      expect(screen.getByText("Critical")).toBeInTheDocument();
    });

    it("renders High severity with distinct text", () => {
      render(<SeverityBadge severity="High" />);
      expect(screen.getByText("High")).toBeInTheDocument();
    });

    it("renders Medium severity with distinct text", () => {
      render(<SeverityBadge severity="Medium" />);
      expect(screen.getByText("Medium")).toBeInTheDocument();
    });

    it("renders Low severity with distinct text", () => {
      render(<SeverityBadge severity="Low" />);
      expect(screen.getByText("Low")).toBeInTheDocument();
    });
  });

  describe("FeasibilityBadge", () => {
    it("renders FEASIBLE badge", () => {
      render(<FeasibilityBadge status="FEASIBLE" />);
      expect(screen.getByText("Feasible")).toBeInTheDocument();
    });

    it("renders TRAIN_CONFLICT badge", () => {
      render(<FeasibilityBadge status="TRAIN_CONFLICT" />);
      expect(screen.getByText("Train Conflict")).toBeInTheDocument();
    });

    it("renders DURATION_INSUFFICIENT badge", () => {
      render(<FeasibilityBadge status="DURATION_INSUFFICIENT" />);
      expect(screen.getByText("Duration Short")).toBeInTheDocument();
    });
  });

  describe("SolverStatusBadge", () => {
    it("renders OPTIMAL solver badge", () => {
      render(<SolverStatusBadge status="OPTIMAL" />);
      expect(screen.getByText("Optimal")).toBeInTheDocument();
    });

    it("renders INFEASIBLE solver badge", () => {
      render(<SolverStatusBadge status="INFEASIBLE" />);
      expect(screen.getByText("Infeasible")).toBeInTheDocument();
    });
  });

  describe("ApprovalBadge", () => {
    it("renders Candidate status for algorithmic suggestions", () => {
      render(<ApprovalBadge status="Candidate" />);
      expect(screen.getByText("Candidate")).toBeInTheDocument();
    });

    it("renders Approved status for authorized possessions", () => {
      render(<ApprovalBadge status="Approved" />);
      expect(screen.getByText("Approved")).toBeInTheDocument();
    });

    it("renders Rejected status for denied possessions", () => {
      render(<ApprovalBadge status="Rejected" />);
      expect(screen.getByText("Rejected")).toBeInTheDocument();
    });
  });
});
