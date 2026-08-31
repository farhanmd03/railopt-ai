"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AuthUser } from "@/lib/auth-config";
import { OptimizationRun } from "@/lib/types/optimization";
import { formatDateTime } from "@/lib/utils";
import {
  Calendar,
  Cpu,
  RefreshCw,
  Sparkles,
  Train,
  User as UserIcon,
} from "lucide-react";

interface DashboardHeaderProps {
  user: AuthUser | null;
  latestRun?: OptimizationRun | null;
  isRefreshing?: boolean;
  onRefresh?: () => void;
}

export function DashboardHeader({
  user,
  latestRun,
  isRefreshing,
  onRefresh,
}: DashboardHeaderProps) {
  const isPlannerOrAdmin =
    user?.roles?.includes("PLANNER") || user?.roles?.includes("ADMIN");

  return (
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-border">
      {/* Title & Division Context */}
      <div className="space-y-1">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-900 text-white dark:bg-slate-800 px-2.5 py-1 rounded text-xs font-bold tracking-wider">
            <Train className="h-3.5 w-3.5 text-blue-400" />
            <span>HOWRAH DIVISION (HWH)</span>
          </div>
          <Badge variant="outline" className="text-[11px] font-medium border-slate-300 text-slate-700 bg-slate-50">
            Eastern Railway
          </Badge>
          {latestRun?.planning_horizon_start && latestRun?.planning_horizon_end && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded border border-border">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span>
                Horizon: {formatDateTime(latestRun.planning_horizon_start)} –{" "}
                {formatDateTime(latestRun.planning_horizon_end)}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 pt-1">
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Maintenance Planning & Corridor Optimization Control Center
          </h1>
        </div>
        <p className="text-xs text-muted-foreground">
          Real-time synthesis of defect work orders, corridor possession windows, train conflicts, and CP-SAT solver results.
        </p>
      </div>

      {/* Authenticated User Status & Role-Aware Actions */}
      <div className="flex items-center gap-2.5 flex-wrap shrink-0">
        {user && (
          <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded text-xs text-muted-foreground">
            <UserIcon className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold text-foreground">{user.name || user.username}</span>
            <div className="flex gap-1">
              {user.roles?.map((role) => (
                <span
                  key={role}
                  className="rounded bg-blue-50 dark:bg-blue-950 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                >
                  {role}
                </span>
              ))}
            </div>
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="gap-1.5 text-xs h-8"
          title="Refresh live operational data"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-primary" : ""}`} />
          <span>{isRefreshing ? "Updating..." : "Refresh"}</span>
        </Button>

        {isPlannerOrAdmin && (
          <>
            <Link href="/planning">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                <span>Open Planning</span>
              </Button>
            </Link>
            <Link href="/optimization">
              <Button size="sm" className="gap-1.5 text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white">
                <Cpu className="h-3.5 w-3.5" />
                <span>Optimization Engine</span>
              </Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
