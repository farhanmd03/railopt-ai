"use client";

import React from "react";
import { OptimizedBlock } from "@/lib/types/optimization";
import { formatDateTime, formatDuration, formatScore } from "@/lib/utils";
import { Clock, Layers, MapPin, Sparkles, Train, Wrench } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

interface ScheduleTimelineViewProps {
  blocks: OptimizedBlock[];
  selectedBlockId: string | null;
  onSelectBlock: (block: OptimizedBlock) => void;
}

export function ScheduleTimelineView({
  blocks,
  selectedBlockId,
  onSelectBlock,
}: ScheduleTimelineViewProps) {
  // Group blocks by section
  const sectionGroups = React.useMemo(() => {
    const map = new Map<string, OptimizedBlock[]>();
    blocks.forEach((b) => {
      if (!map.has(b.section_id)) {
        map.set(b.section_id, []);
      }
      map.get(b.section_id)!.push(b);
    });

    // Sort blocks inside each section by start time
    map.forEach((list) => {
      list.sort((a, b) => new Date(a.block_start).getTime() - new Date(b.block_start).getTime());
    });

    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [blocks]);

  if (blocks.length === 0) {
    return (
      <div className="bg-card border border-border rounded p-8 text-center text-muted-foreground text-xs italic">
        No optimized maintenance blocks match current filters.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sectionGroups.map(([sectionId, sectionBlocks]) => (
        <div
          key={sectionId}
          className="bg-card border border-border rounded shadow-xs overflow-hidden"
        >
          {/* Section Header */}
          <div className="p-3 border-b border-border bg-muted/30 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200">
                <MapPin className="h-3.5 w-3.5" />
              </div>
              <span className="font-mono font-extrabold text-xs text-foreground">
                Section: {sectionId}
              </span>
            </div>
            <span className="text-xs font-semibold text-muted-foreground font-mono">
              {sectionBlocks.length} {sectionBlocks.length === 1 ? "Scheduled Possession" : "Scheduled Possessions"} •{" "}
              {formatDuration(sectionBlocks.reduce((acc, b) => acc + (b.block_duration_hrs || 0), 0))} total
            </span>
          </div>

          {/* Section Blocks Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/10">
                <TableRow>
                  <TableHead className="text-xs font-bold w-[130px]">Block ID</TableHead>
                  <TableHead className="text-xs font-bold">Scheduled Window (WHEN)</TableHead>
                  <TableHead className="text-xs font-bold text-right">Duration</TableHead>
                  <TableHead className="text-xs font-bold">Departments (WHO)</TableHead>
                  <TableHead className="text-xs font-bold">Work Orders (WHAT)</TableHead>
                  <TableHead className="text-xs font-bold text-right">Realized Priority</TableHead>
                  <TableHead className="text-xs font-bold text-center w-[90px]">Type</TableHead>
                  <TableHead className="text-xs font-bold text-center w-[70px]">Inspect</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sectionBlocks.map((block) => {
                  const isSelected = selectedBlockId === block.optimized_block_id;
                  const isIntegrated = block.is_integrated;
                  const depts = block.departments_involved || [];

                  return (
                    <TableRow
                      key={block.id}
                      onClick={() => onSelectBlock(block)}
                      tabIndex={0}
                      role="button"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelectBlock(block);
                        }
                      }}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-blue-50/80 dark:bg-blue-950/40 border-l-2 border-l-primary"
                          : "hover:bg-muted/30"
                      }`}
                    >
                      <TableCell className="font-mono text-xs font-bold text-foreground">
                        {block.optimized_block_id}
                      </TableCell>

                      <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                        <span>{formatDateTime(block.block_start)}</span>
                        <span className="mx-1 text-muted-foreground/60">→</span>
                        <span>{formatDateTime(block.block_end)}</span>
                      </TableCell>

                      <TableCell className="text-right font-mono text-xs font-semibold text-foreground">
                        {formatDuration(block.block_duration_hrs)}
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-wrap gap-1 items-center">
                          {depts.map((d) => (
                            <span
                              key={d}
                              className={`rounded px-1.5 py-0.2 text-[10px] font-semibold border ${
                                d === "Engineering"
                                  ? "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                                  : d === "S&T"
                                  ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                  : "bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                              }`}
                            >
                              {d}
                            </span>
                          ))}
                        </div>
                      </TableCell>

                      <TableCell className="font-mono text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">{block.task_ids.length}</span>{" "}
                        ({block.task_ids.join(", ")})
                      </TableCell>

                      <TableCell className="text-right font-mono text-xs font-extrabold text-blue-600 dark:text-blue-400">
                        {formatScore(block.realized_priority_value)}
                      </TableCell>

                      <TableCell className="text-center">
                        {isIntegrated ? (
                          <span className="rounded bg-purple-100 dark:bg-purple-950 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                            Joint
                          </span>
                        ) : (
                          <span className="rounded bg-blue-100 dark:bg-blue-950 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            Single
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectBlock(block);
                          }}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          title="Inspect block details"
                        >
                          <Wrench className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
    </div>
  );
}
