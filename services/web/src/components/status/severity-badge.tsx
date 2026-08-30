import React from "react";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, AlertTriangle, Info, ShieldAlert } from "lucide-react";

export type SeverityLevel = "Critical" | "High" | "Medium" | "Low" | string;

interface SeverityBadgeProps {
  severity: SeverityLevel | null | undefined;
  className?: string;
  showIcon?: boolean;
}

export function SeverityBadge({
  severity,
  className,
  showIcon = true,
}: SeverityBadgeProps) {
  const norm = (severity || "Low").toLowerCase();

  if (norm === "critical") {
    return (
      <Badge variant="danger" className={className}>
        {showIcon && <ShieldAlert className="h-3 w-3" />}
        <span>Critical</span>
      </Badge>
    );
  }
  if (norm === "high") {
    return (
      <Badge variant="warning" className={className}>
        {showIcon && <AlertTriangle className="h-3 w-3" />}
        <span>High</span>
      </Badge>
    );
  }
  if (norm === "medium") {
    return (
      <Badge variant="info" className={className}>
        {showIcon && <AlertCircle className="h-3 w-3" />}
        <span>Medium</span>
      </Badge>
    );
  }
  return (
    <Badge variant="neutral" className={className}>
      {showIcon && <Info className="h-3 w-3" />}
      <span>Low</span>
    </Badge>
  );
}
