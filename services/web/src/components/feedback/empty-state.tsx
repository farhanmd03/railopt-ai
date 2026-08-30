import React from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title = "No records found",
  description = "There are no railway maintenance records matching the specified criteria.",
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-10 text-center rounded border border-dashed border-border bg-card/50",
        className
      )}
    >
      <div className="rounded-full bg-muted p-3 mb-3 text-muted-foreground">
        {icon || <Inbox className="h-6 w-6" />}
      </div>
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      <p className="text-xs text-muted-foreground mt-1 max-w-sm">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
