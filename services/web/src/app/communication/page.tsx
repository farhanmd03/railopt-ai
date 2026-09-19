"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "react-oidc-context";
import { buildAuthUser } from "@/lib/auth-config";
import * as optimizationApi from "@/lib/api/optimization";
import { OptimizedBlock, OptimizationRun } from "@/lib/types/optimization";
import { PageHeader } from "@/components/layout/page-header";
import { DepartmentCommunicationChannel } from "@/components/communication/department-communication-channel";
import { SourceBadge } from "@/components/optimization/source-badge";
import { formatDateTime, formatDuration } from "@/lib/utils";
import {
  MessageSquare,
  Layers,
  Clock,
  Wrench,
  ChevronRight,
  ExternalLink,
  Sparkles,
  MapPin,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CommunicationPage() {
  const auth = useAuth();
  const user = React.useMemo(() => buildAuthUser(auth.user), [auth.user]);

  // Fetch runs
  const runsQuery = useQuery({
    queryKey: ["optimization-runs-comm"],
    queryFn: () => optimizationApi.getOptimizationRuns({ page: 1, page_size: 10 }),
  });

  const runs = runsQuery.data?.items || [];
  const latestRunId = runs.length > 0 ? runs[0].id : null;

  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<number | null>(null);

  useEffect(() => {
    if (latestRunId && !selectedRunId) {
      setSelectedRunId(latestRunId);
    }
  }, [latestRunId, selectedRunId]);

  // Fetch blocks for the selected run
  const blocksQuery = useQuery({
    queryKey: ["optimized-blocks-comm", selectedRunId],
    queryFn: () => {
      if (!selectedRunId) {
        return Promise.resolve({
          items: [],
          total: 0,
          page: 1,
          page_size: 50,
          total_pages: 0,
        });
      }
      return optimizationApi.getOptimizedBlocks(selectedRunId, { page_size: 50 });
    },
    enabled: !!selectedRunId,
  });

  const blocks: OptimizedBlock[] = blocksQuery.data?.items || [];

  // Auto-select first block when blocks load
  useEffect(() => {
    if (blocks.length > 0 && !selectedBlockId) {
      setSelectedBlockId(blocks[0].id);
    } else if (blocks.length > 0 && selectedBlockId && !blocks.some((b) => b.id === selectedBlockId)) {
      setSelectedBlockId(blocks[0].id);
    }
  }, [blocks, selectedBlockId]);

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) || null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Inter-Department Communication
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Shared operational discussion between Engineering, S&T and TRD.
          </p>
        </div>

        {/* Run Selector */}
        <div className="flex items-center gap-2">
          {runs.length > 0 && (
            <select
              value={selectedRunId || ""}
              onChange={(e) => {
                setSelectedRunId(Number(e.target.value));
                setSelectedBlockId(null);
              }}
              className="rounded border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground"
            >
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.run_id} ({r.solver_status})
                </option>
              ))}
            </select>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              runsQuery.refetch();
              blocksQuery.refetch();
            }}
            className="h-8 text-xs gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${blocksQuery.isFetching ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Main Grid: Left side Active Possession Channels, Right side Selected Channel Conversation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Active Possession Channels List */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Active Possession Channels ({blocks.length})
            </span>
          </div>

          {blocksQuery.isLoading ? (
            <div className="p-8 text-center text-xs text-muted-foreground border rounded-lg bg-card flex flex-col items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
              <span>Loading possession blocks...</span>
            </div>
          ) : blocks.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground border rounded-lg bg-card">
              No optimized blocks found for the selected planning run.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              {blocks.map((b) => {
                const isSelected = b.id === selectedBlockId;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedBlockId(b.id)}
                    className={`w-full text-left p-3.5 rounded-lg border transition-all text-xs space-y-2 cursor-pointer ${
                      isSelected
                        ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 shadow-xs ring-1 ring-blue-400"
                        : "border-border bg-card hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5 text-blue-600" />
                        <span className="font-bold text-foreground">
                          {b.optimized_block_id}
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        Section {b.section_id}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{formatDateTime(b.block_start)} ({formatDuration(b.block_duration_hrs)})</span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      {b.departments_involved.map((dept) => (
                        <span
                          key={dept}
                          className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border ${
                            dept.toLowerCase().includes("eng")
                              ? "bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200"
                              : dept.toLowerCase().includes("snt") || dept.toLowerCase().includes("s&t")
                              ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200"
                              : "bg-purple-50 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 border-purple-200"
                          }`}
                        >
                          {dept}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[10px] text-muted-foreground">
                      <span>{b.task_ids.length} work orders</span>
                      <span className="flex items-center gap-0.5 text-blue-600 font-semibold">
                        <span>Open Channel</span>
                        <ChevronRight className="h-3 w-3" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Selected Block Details & Reusable DepartmentCommunicationChannel */}
        <div className="lg:col-span-7 space-y-4">
          {selectedBlock ? (
            <div className="space-y-4">
              {/* Possession Context Card */}
              <div className="rounded-lg border border-border bg-card p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                      Active Channel Context
                    </span>
                    <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                      <span>{selectedBlock.optimized_block_id}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200">
                        Section {selectedBlock.section_id}
                      </span>
                    </h2>
                  </div>

                  <div className="flex items-center gap-2">
                    {user?.roles.some((r) => ["ADMIN", "PLANNER", "CONTROL", "APPROVER"].includes(r)) && (
                      <Link
                        href={`/optimization/runs/${selectedBlock.optimization_run_id}?block=${selectedBlock.id}`}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 px-2.5 py-1 rounded"
                      >
                        <span>Open in Solver Workbench</span>
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="p-2.5 rounded bg-muted/20 border border-border">
                    <span className="text-[10px] text-muted-foreground block font-semibold">Window Start</span>
                    <span className="font-semibold text-foreground">{formatDateTime(selectedBlock.block_start)}</span>
                  </div>
                  <div className="p-2.5 rounded bg-muted/20 border border-border">
                    <span className="text-[10px] text-muted-foreground block font-semibold">Duration</span>
                    <span className="font-semibold text-foreground">{formatDuration(selectedBlock.block_duration_hrs)}</span>
                  </div>
                  <div className="p-2.5 rounded bg-muted/20 border border-border">
                    <span className="text-[10px] text-muted-foreground block font-semibold">Departments</span>
                    <span className="font-semibold text-foreground">{selectedBlock.departments_involved.join(", ")}</span>
                  </div>
                </div>
              </div>

              {/* Reusable Communication Channel */}
              <DepartmentCommunicationChannel
                blockId={selectedBlock.id}
                departments={selectedBlock.departments_involved}
              />
            </div>
          ) : (
            <div className="p-12 text-center text-xs text-muted-foreground border rounded-lg bg-card">
              Select a possession channel from the list on the left to view and post messages.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
