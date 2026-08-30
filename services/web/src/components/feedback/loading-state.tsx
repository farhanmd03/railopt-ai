import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  message?: string;
  className?: string;
  rows?: number;
}

export function LoadingState({
  message = "Loading railway operational data...",
  className,
  rows = 3,
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 space-y-4 text-center rounded border border-border bg-card",
        className
      )}
    >
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <p className="text-xs font-medium text-muted-foreground">{message}</p>
      <div className="w-full max-w-md space-y-2 pt-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    </div>
  );
}
