import React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Failed to load operational data",
  message = "An unexpected error occurred while communicating with the optimization backend.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 text-center rounded border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-card-foreground",
        className
      )}
    >
      <div className="rounded-full bg-red-100 p-3 mb-3 text-[var(--status-danger)]">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h4 className="text-sm font-semibold text-[var(--status-danger-text)]">
        {title}
      </h4>
      <p className="text-xs text-muted-foreground mt-1 max-w-sm">{message}</p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="mt-4 gap-1.5 text-xs"
        >
          <RefreshCw className="h-3 w-3" />
          <span>Retry Request</span>
        </Button>
      )}
    </div>
  );
}
