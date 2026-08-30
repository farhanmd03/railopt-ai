import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wider transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border border-transparent bg-primary text-primary-foreground",
        secondary:
          "border border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground border border-border",
        success:
          "border border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]",
        warning:
          "border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]",
        danger:
          "border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]",
        info:
          "border border-[var(--status-info-border)] bg-[var(--status-info-bg)] text-[var(--status-info-text)]",
        neutral:
          "border border-[var(--status-neutral-border)] bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
