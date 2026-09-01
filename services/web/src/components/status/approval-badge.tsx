import React from "react";
import { Badge } from "@/components/ui/badge";
import { Check, X, Clock, Sparkles, FileText } from "lucide-react";

export type ApprovalStatusType =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "Candidate"
  | "Approved"
  | "Rejected"
  | "Pending"
  | string;

interface ApprovalBadgeProps {
  status: ApprovalStatusType | null | undefined;
  className?: string;
  showIcon?: boolean;
}

export function ApprovalBadge({
  status,
  className,
  showIcon = true,
}: ApprovalBadgeProps) {
  const raw = status || "DRAFT";
  const norm = raw.toLowerCase().trim();

  if (norm === "approved") {
    return (
      <Badge variant="success" className={className}>
        {showIcon && <Check className="h-3 w-3" />}
        <span>Approved</span>
      </Badge>
    );
  }
  if (norm === "rejected") {
    return (
      <Badge variant="danger" className={className}>
        {showIcon && <X className="h-3 w-3" />}
        <span>Rejected</span>
      </Badge>
    );
  }
  if (norm === "submitted") {
    return (
      <Badge variant="warning" className={className}>
        {showIcon && <Clock className="h-3 w-3" />}
        <span>Submitted</span>
      </Badge>
    );
  }
  if (norm === "pending") {
    return (
      <Badge variant="warning" className={className}>
        {showIcon && <Clock className="h-3 w-3" />}
        <span>Pending</span>
      </Badge>
    );
  }
  if (norm === "draft") {
    return (
      <Badge variant="neutral" className={className}>
        {showIcon && <FileText className="h-3 w-3" />}
        <span>Draft</span>
      </Badge>
    );
  }
  return (
    <Badge variant="info" className={className}>
      {showIcon && <Sparkles className="h-3 w-3" />}
      <span>Candidate</span>
    </Badge>
  );
}
