import React from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle } from "lucide-react";

export type SolverStatusType = "OPTIMAL" | "FEASIBLE" | "INFEASIBLE" | "UNKNOWN" | string;

interface SolverStatusBadgeProps {
  status: SolverStatusType | null | undefined;
  className?: string;
  showIcon?: boolean;
}

export function SolverStatusBadge({
  status,
  className,
  showIcon = true,
}: SolverStatusBadgeProps) {
  const norm = (status || "UNKNOWN").toUpperCase();

  if (norm === "OPTIMAL") {
    return (
      <Badge variant="info" className={className}>
        {showIcon && <CheckCircle2 className="h-3 w-3" />}
        <span>Optimal</span>
      </Badge>
    );
  }
  if (norm === "FEASIBLE") {
    return (
      <Badge variant="success" className={className}>
        {showIcon && <CheckCircle2 className="h-3 w-3" />}
        <span>Feasible</span>
      </Badge>
    );
  }
  if (norm === "INFEASIBLE") {
    return (
      <Badge variant="danger" className={className}>
        {showIcon && <XCircle className="h-3 w-3" />}
        <span>Infeasible</span>
      </Badge>
    );
  }
  return (
    <Badge variant="neutral" className={className}>
      {showIcon && <HelpCircle className="h-3 w-3" />}
      <span>{status || "Unknown"}</span>
    </Badge>
  );
}
