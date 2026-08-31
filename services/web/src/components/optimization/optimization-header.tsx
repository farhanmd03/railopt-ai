"use client";

import React from "react";
import Link from "next/link";
import { AuthUser } from "@/lib/auth-config";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Cpu, RefreshCw, TramFront, User as UserIcon, Shield } from "lucide-react";

interface OptimizationHeaderProps {
  user: AuthUser | null;
  isRefreshing?: boolean;
  onRefresh?: () => void;
}

export function OptimizationHeader({
  user,
  isRefreshing,
  onRefresh,
}: OptimizationHeaderProps) {
  const canGenerate =
    user?.roles.includes("PLANNER") ||
    user?.roles.includes("ADMIN") ||
    user?.roles.includes("CONTROL");

  return (
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-border">
      <div className="space-y-1">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-900 text-white dark:bg-slate-800 px-2.5 py-1 rounded text-xs font-bold tracking-wider">
            <TramFront className="h-3.5 w-3.5 text-blue-400" />
            <span>HOWRAH DIVISION (HWH)</span>
          </div>
          <span className="rounded px-2 py-0.5 uppercase tracking-wider text-[11px] font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900">
            Eastern Railway
          </span>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded border border-border">
            <Cpu className="h-3 w-3 text-blue-600" />
            <span>Google OR-Tools CP-SAT Solver Engine</span>
          </div>
        </div>

        <h1 className="text-xl font-bold tracking-tight text-foreground pt-1">
          Railway Maintenance Optimization Planner
        </h1>
        <p className="text-xs text-muted-foreground">
          Generate globally optimal multi-department maintenance schedules using constraint satisfaction and integer programming.
        </p>
      </div>

      {/* User Identity & Navigation Actions */}
      <div className="flex items-center gap-2.5 flex-wrap shrink-0">
        <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded text-xs text-muted-foreground">
          <UserIcon className="h-3.5 w-3.5 text-primary" />
          <span className="font-semibold text-foreground">
            {user?.name || user?.username || "Authorized User"}
          </span>
          <div className="flex gap-1">
            {user?.roles.map((r) => (
              <span
                key={r}
                className="rounded bg-blue-50 dark:bg-blue-950 px-1.5 py-0.2 text-[10px] font-bold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
              >
                {r}
              </span>
            ))}
          </div>
        </div>

        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="h-8 gap-1.5 text-xs bg-card hover:bg-muted"
            title="Refresh optimization runs"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-primary" : ""}`}
            />
            <span>{isRefreshing ? "Updating..." : "Refresh"}</span>
          </Button>
        )}

        <Link href="/planning">
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Planning Workspace</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}
