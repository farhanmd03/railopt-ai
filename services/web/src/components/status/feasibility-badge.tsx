import React from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Ban, AlertOctagon } from "lucide-react";

export type FeasibilityStatus =
  | "FEASIBLE"
  | "TRAIN_CONFLICT"
  | "DURATION_INSUFFICIENT"
  | "BLOCKED"
  | string;

interface FeasibilityBadgeProps {
  status: FeasibilityStatus | null | undefined;
  className?: string;
  showIcon?: boolean;
}

export function FeasibilityBadge({
  status,
  className,
  showIcon = true,
}: FeasibilityBadgeProps) {
  const norm = (status || "").toUpperCase();

  if (norm === "FEASIBLE") {
    return (
      <Badge variant="success" className={className}>
        {showIcon && <CheckCircle2 className="h-3 w-3" />}
        <span>Feasible</span>
      </Badge>
    );
  }
  if (norm === "TRAIN_CONFLICT") {
    return (
      <Badge variant="danger" className={className}>
        {showIcon && <AlertOctagon className="h-3 w-3" />}
        <span>Train Conflict</span>
      </Badge>
    );
  }
  if (norm === "DURATION_INSUFFICIENT") {
    return (
      <Badge variant="warning" className={className}>
        {showIcon && <Clock className="h-3 w-3" />}
        <span>Duration Short</span>
      </Badge>
    );
  }
  return (
    <Badge variant="neutral" className={className}>
      {showIcon && <Ban className="h-3 w-3" />}
      <span>{status || "Blocked"}</span>
    </Badge>
  );
}
