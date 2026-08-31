"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Cpu, Layers, Shield, Sparkles, Train } from "lucide-react";

interface SolverLoadingStateProps {
  planningStart: string;
  planningEnd: string;
}

export function SolverLoadingState({
  planningStart,
  planningEnd,
}: SolverLoadingStateProps) {
  return (
    <Card className="border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20 shadow-md">
      <CardContent className="p-6 sm:p-8 space-y-6 text-center">
        {/* Animated Icon */}
        <div className="relative inline-flex items-center justify-center">
          <div className="h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center animate-pulse">
            <Cpu className="h-8 w-8 text-blue-600 animate-spin" style={{ animationDuration: "3s" }} />
          </div>
          <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center animate-ping" />
        </div>

        {/* Status Texts */}
        <div className="space-y-1.5 max-w-md mx-auto">
          <h3 className="text-base font-bold text-foreground">
            Generating Optimization Plan...
          </h3>
          <p className="text-xs text-muted-foreground">
            Google OR-Tools CP-SAT integer programming solver is exploring combinatorial corridor possession options for Howrah Division.
          </p>
        </div>

        {/* Active Stage Indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mx-auto text-left text-xs">
          <div className="p-3 rounded bg-card border border-border shadow-2xs space-y-1">
            <div className="flex items-center gap-1.5 text-blue-600 font-semibold">
              <Layers className="h-3.5 w-3.5" />
              <span>Horizon Bounds</span>
            </div>
            <p className="text-[11px] text-muted-foreground font-mono">
              {planningStart} → {planningEnd}
            </p>
          </div>

          <div className="p-3 rounded bg-card border border-border shadow-2xs space-y-1">
            <div className="flex items-center gap-1.5 text-purple-600 font-semibold">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Model Formulation</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Integer boolean variables & multi-task bonuses
            </p>
          </div>

          <div className="p-3 rounded bg-card border border-border shadow-2xs space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-600 font-semibold">
              <Shield className="h-3.5 w-3.5" />
              <span>Invariants Enforced</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Single assignment & temporal section exclusivity
            </p>
          </div>
        </div>

        <div className="text-[11px] text-muted-foreground italic">
          Transaction will be persisted into PostgreSQL upon solver termination.
        </div>
      </CardContent>
    </Card>
  );
}
