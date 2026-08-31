"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScenarioBlockSummary } from "@/lib/types/scenario";
import { OptimizedBlock } from "@/lib/types/optimization";
import { PlusCircle, MinusCircle, CheckCircle2, MapPin, Clock, Users, ArrowRight } from "lucide-react";

interface ScenarioBlockDiffProps {
  blockDiff: ScenarioBlockSummary;
  scenarioRunId?: number | null;
}

export function ScenarioBlockDiff({ blockDiff, scenarioRunId }: ScenarioBlockDiffProps) {
  const [filter, setFilter] = useState<"added" | "removed" | "retained">("added");

  const categories = [
    {
      id: "added" as const,
      label: "Added Blocks",
      count: blockDiff.added_block_count,
      icon: PlusCircle,
      badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300",
      description: "Blocks generated under this scenario that were not present in the Base Run.",
      blocks: blockDiff.added_blocks,
    },
    {
      id: "removed" as const,
      label: "Removed Blocks",
      count: blockDiff.removed_block_count,
      icon: MinusCircle,
      badgeColor: "bg-amber-100 text-amber-800 border-amber-300",
      description: "Blocks present in the Base Run that were eliminated or reshuffled in this scenario.",
      blocks: blockDiff.removed_blocks,
    },
    {
      id: "retained" as const,
      label: "Retained Blocks",
      count: blockDiff.retained_block_count,
      icon: CheckCircle2,
      badgeColor: "bg-slate-100 text-slate-800 border-slate-300",
      description: "Identical corridor blocks maintained across both the Base Run and this scenario.",
      blocks: blockDiff.retained_blocks,
    },
  ];

  const currentCategory = categories.find((c) => c.id === filter) || categories[0];

  const formatDateTime = (isoString?: string) => {
    if (!isoString) return "—";
    try {
      const d = new Date(isoString);
      return d.toLocaleString("en-IN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } catch {
      return isoString;
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3 border-b border-border/50">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="text-base font-bold text-foreground">
              Block-Level Corridor Comparison
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Specific track possession windows altered by the modified planning parameters
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {/* Category Toggles */}
        <div className="flex flex-wrap gap-2 border-b border-border pb-3">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = filter === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setFilter(cat.id)}
                type="button"
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all border ${
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{cat.label}</span>
                <span
                  className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-foreground"
                  }`}
                >
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Category Description */}
        <div className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded border border-border/60">
          {currentCategory.description}
        </div>

        {/* Blocks Table */}
        {currentCategory.blocks.length > 0 ? (
          <div className="overflow-x-auto border border-border rounded-md">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/50 font-semibold text-muted-foreground uppercase tracking-wider">
                  <th className="py-2.5 px-3">Section ID</th>
                  <th className="py-2.5 px-3">Window (Start → End)</th>
                  <th className="py-2.5 px-3 text-right">Duration</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Departments</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {currentCategory.blocks.map((block: OptimizedBlock, idx: number) => {
                  const isIntegrated = block.is_integrated;
                  const depts = block.departments_involved || [];

                  return (
                    <tr key={block.id || idx} className="hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-3 font-semibold font-mono text-foreground">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                          <span>{block.section_id || "HOWRAH-DIV"}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span>{formatDateTime(block.block_start)}</span>
                          <span>→</span>
                          <span>{formatDateTime(block.block_end)}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-foreground">
                        {block.block_duration_hrs ? `${Number(block.block_duration_hrs).toFixed(1)}h` : "—"}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                            isIntegrated
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : "bg-slate-50 text-slate-700 border-slate-200"
                          }`}
                        >
                          {isIntegrated ? "INTEGRATED" : "SINGLE"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          {depts.map((dept) => (
                            <span
                              key={dept}
                              className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-blue-50 text-blue-700 border border-blue-200"
                            >
                              {dept}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {scenarioRunId && block.section_id && (
                          <Link
                            href={`/map?run=${scenarioRunId}&section=${encodeURIComponent(block.section_id)}`}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                            title="Inspect on Interactive Railway Map"
                          >
                            <span>Map</span>
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No blocks in this category for the current scenario.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
