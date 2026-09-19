"use client";

import React from "react";
import { SOURCE_BADGES } from "@/lib/types/possession";

interface SourceBadgeProps {
  department: string;
  className?: string;
  showTooltip?: boolean;
}

const badgeColors: Record<string, string> = {
  Engineering:
    "bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  "S&T":
    "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  TRD: "bg-purple-50 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  Timetable:
    "bg-sky-50 dark:bg-sky-950/50 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800",
};

export function SourceBadge({
  department,
  className = "",
  showTooltip = true,
}: SourceBadgeProps) {
  const badge = SOURCE_BADGES[department];
  if (!badge) return null;

  const colorClass =
    badgeColors[department] ||
    "bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold ${colorClass} ${className}`}
      title={
        showTooltip
          ? `${badge.label}${badge.isPrototype ? " (Prototype Adapter)" : ""}`
          : undefined
      }
    >
      <span className="font-mono">{badge.source}</span>
      {badge.isPrototype && (
        <span className="rounded bg-slate-200/80 dark:bg-slate-700/80 px-1 py-px text-[8px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-tight">
          Prototype
        </span>
      )}
    </span>
  );
}
