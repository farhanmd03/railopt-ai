"use client";

import React from "react";
import { ExplanationRequest, ExplanationResponse } from "@/lib/types/explanation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sparkles,
  X,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Info,
  Loader2,
  RotateCcw,
  Layers,
  FileText,
} from "lucide-react";

interface ExplanationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  request: ExplanationRequest | null;
  explanation: ExplanationResponse | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

export function ExplanationDrawer({
  isOpen,
  onClose,
  request,
  explanation,
  isLoading,
  error,
  onRetry,
}: ExplanationDrawerProps) {
  if (!isOpen) return null;

  const titleMap: Record<string, string> = {
    RUN_SUMMARY: "Optimization Run Summary Explanation",
    BLOCK_EXPLANATION: "Corridor Possession Block Explanation",
    UNASSIGNED_TASK: "Unassigned Work Order Explanation",
    SCENARIO_COMPARISON: "What-If Scenario Delta Explanation",
  };

  const currentTitle = request
    ? titleMap[request.explanation_type] || "Operational Explanation"
    : "Operational Explanation";

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-background/80 backdrop-blur-xs transition-opacity">
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-2xl bg-card border-l border-border shadow-2xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">
                  {currentTitle}
                </h2>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <span className="flex items-center gap-1 font-mono">
                    <Cpu className="h-3.5 w-3.5 text-blue-600" />
                    {explanation?.model_name || "Local Ollama"}
                  </span>
                  <span>•</span>
                  <span>Grounded in CP-SAT Outputs</span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              type="button"
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* 1. Mandatory Advisory Disclaimer Banner */}
            <div className="rounded-lg border border-amber-300 bg-amber-50/80 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5 shadow-2xs">
              <ShieldAlert className="h-4 w-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed font-medium">
                {explanation?.disclaimer ||
                  "AI-generated explanation based on deterministic system outputs. The explanation does not make scheduling, safety, or approval decisions."}
              </p>
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="py-16 text-center space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-foreground">
                    Consulting Local Ollama Model...
                  </h4>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Synthesizing verified solver metrics into a structured natural-language operational explanation.
                  </p>
                </div>
              </div>
            )}

            {/* Error / Service Unavailable State */}
            {!isLoading && error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center space-y-4">
                <div className="inline-flex p-3 rounded-full bg-destructive/10 text-destructive">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-destructive">
                    Local Explanation Service Unavailable
                  </h4>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    {error}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRetry}
                  className="text-xs gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Retry Explanation</span>
                </Button>
              </div>
            )}

            {/* Loaded Explanation Content */}
            {!isLoading && !error && explanation && (
              <div className="space-y-6">
                {/* Executive Summary Card */}
                <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/20 shadow-xs">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-700 dark:text-blue-300" />
                      <CardTitle className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-200">
                        Operational Summary
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-foreground leading-relaxed font-normal">
                      {explanation.summary}
                    </p>
                  </CardContent>
                </Card>

                {/* Key Contributing Factors */}
                {explanation.key_factors && explanation.key_factors.length > 0 && (
                  <Card className="shadow-xs">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">
                          Key Contributing Factors
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-2">
                      {explanation.key_factors.map((factor, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-foreground">
                          <span className="text-emerald-600 font-bold">•</span>
                          <span className="leading-normal">{factor}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Operational Limitations & Boundary Conditions */}
                {explanation.limitations && explanation.limitations.length > 0 && (
                  <Card className="shadow-xs border-amber-200/70 bg-amber-50/20 dark:bg-amber-950/10">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
                          Boundary Conditions & Constraints
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-2">
                      {explanation.limitations.map((limit, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <span className="text-amber-600 font-bold">•</span>
                          <span className="leading-normal">{limit}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Deterministic Facts Panel */}
                <Card className="shadow-xs border-border/80">
                  <CardHeader className="pb-2 border-b border-border/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4 text-slate-700 dark:text-slate-300" />
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">
                          Authoritative Underlying Evidence
                        </CardTitle>
                      </div>
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                        Verified Facts
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <tbody className="divide-y divide-border/60">
                        {Object.entries(explanation.deterministic_facts || {}).map(
                          ([key, value]) => {
                            if (key === "assigned_tasks" || key === "comparison") return null;
                            const formattedKey = key
                              .replace(/_/g, " ")
                              .replace(/\b\w/g, (c) => c.toUpperCase());
                            const displayValue =
                              typeof value === "boolean"
                                ? value
                                  ? "Yes"
                                  : "No"
                                : Array.isArray(value)
                                ? value.join(", ")
                                : value !== null && value !== undefined
                                ? String(value)
                                : "—";

                            return (
                              <tr key={key} className="hover:bg-muted/30">
                                <td className="py-2 px-4 font-semibold text-muted-foreground w-1/3">
                                  {formattedKey}
                                </td>
                                <td className="py-2 px-4 font-mono font-medium text-foreground">
                                  {displayValue}
                                </td>
                              </tr>
                            );
                          }
                        )}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>

                {/* Confidence Note */}
                <div className="text-[11px] text-muted-foreground italic flex items-center gap-1.5 p-2 rounded bg-muted/40 border border-border">
                  <Info className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                  <span>{explanation.confidence_note}</span>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              Generated: {explanation?.generated_at ? new Date(explanation.generated_at).toLocaleTimeString() : "—"}
            </span>
            <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
              Close Panel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
