import React from "react";

export type DepartmentType =
  | "Engineering"
  | "Civil"
  | "S&T"
  | "Signaling"
  | "Electrical"
  | "TRD"
  | "OHE"
  | "Operating"
  | "Commercial"
  | string;

interface DepartmentBadgeProps {
  department: DepartmentType | null | undefined;
  className?: string;
}

export function DepartmentBadge({ department, className }: DepartmentBadgeProps) {
  const dept = (department || "Other").trim();
  const lower = dept.toLowerCase();

  let variantClasses =
    "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";

  if (lower.includes("eng") || lower.includes("civil") || lower.includes("track")) {
    variantClasses =
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900";
  } else if (lower.includes("s&t") || lower.includes("sig") || lower.includes("telecom")) {
    variantClasses =
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900";
  } else if (lower.includes("elec") || lower.includes("trd") || lower.includes("ohe")) {
    variantClasses =
      "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900";
  } else if (lower.includes("oper") || lower.includes("traffic") || lower.includes("control")) {
    variantClasses =
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900";
  }

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium border ${variantClasses} ${className || ""}`}
    >
      {dept}
    </span>
  );
}
