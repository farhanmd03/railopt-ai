"use client";

import React, { useMemo } from "react";
import { OptimizedBlock } from "@/lib/types/optimization";
import { formatDateTime, formatDuration, formatScore } from "@/lib/utils";
import { Calendar, Clock, Layers, Sparkles, Wrench } from "lucide-react";

interface PlanningTimelineProps {
  blocks: OptimizedBlock[];
  horizonStart?: string | null;
  horizonEnd?: string | null;
  selectedBlockId: string | null;
  onSelectBlock: (block: OptimizedBlock) => void;
}

export function PlanningTimeline({
  blocks,
  horizonStart,
  horizonEnd,
  selectedBlockId,
  onSelectBlock,
}: PlanningTimelineProps) {
  // Extract distinct sections present in the blocks
  const sections = useMemo(() => {
    const map = new Map<string, OptimizedBlock[]>();
    blocks.forEach((b) => {
      const sec = b.section_id || "UNKNOWN";
      if (!map.has(sec)) {
        map.set(sec, []);
      }
      map.get(sec)!.push(b);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [blocks]);

  // Compute timeline horizon range
  const { minTime, maxTime, totalDurationMs } = useMemo(() => {
    let startMs = horizonStart ? new Date(horizonStart).getTime() : 0;
    let endMs = horizonEnd ? new Date(horizonEnd).getTime() : 0;

    if (!startMs || !endMs || startMs >= endMs) {
      // Fallback: derive from blocks
      if (blocks.length > 0) {
        const starts = blocks.map((b) => new Date(b.block_start).getTime()).filter(Boolean);
        const ends = blocks.map((b) => new Date(b.block_end).getTime()).filter(Boolean);
        startMs = Math.min(...starts);
        endMs = Math.max(...ends);
      } else {
        startMs = Date.now();
        endMs = startMs + 7 * 24 * 3600 * 1000;
      }
    }

    // Safety buffer
    const duration = Math.max(endMs - startMs, 3600 * 1000);
    return { minTime: startMs, maxTime: endMs, totalDurationMs: duration };
  }, [blocks, horizonStart, horizonEnd]);

  // Generate 7-day timeline tick marks
  const tickMarks = useMemo(() => {
    const ticks: { label: string; percent: number }[] = [];
    const numDays = Math.max(Math.ceil(totalDurationMs / (24 * 3600 * 1000)), 1);
    const stepMs = totalDurationMs / Math.min(numDays, 7);

    for (let i = 0; i <= Math.min(numDays, 7); i++) {
      const timeMs = minTime + i * stepMs;
      const date = new Date(timeMs);
      const label = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      const percent = (i * stepMs) / totalDurationMs * 100;
      ticks.push({ label, percent: Math.min(percent, 100) });
    }
    return ticks;
  }, [minTime, totalDurationMs]);

  if (blocks.length === 0) {
    return null;
  }

  return (
    <div className="bg-card border border-border rounded shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-3.5 border-b border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-600 shrink-0" />
          <div>
            <span className="text-xs font-bold text-foreground block">
              Corridor Maintenance Planning Timeline
            </span>
            <span className="text-[11px] text-muted-foreground">
              Multi-section scheduled possession windows. Click any block to view work order details.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground self-start sm:self-auto flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-purple-600" />
            <span>Integrated Joint Block</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-blue-600" />
            <span>Single-Dept Block</span>
          </div>
        </div>
      </div>

      {/* Main Gantt Grid Container */}
      <div className="p-4 overflow-x-auto">
        <div className="min-w-[700px] space-y-4">
          {/* Time Scale Axis */}
          <div className="relative h-6 border-b border-border text-[10px] text-muted-foreground select-none">
            {tickMarks.map((tick, idx) => (
              <div
                key={idx}
                className="absolute -translate-x-1/2 flex flex-col items-center"
                style={{ left: `${tick.percent}%` }}
              >
                <span>{tick.label}</span>
                <div className="h-1.5 w-px bg-border mt-0.5" />
              </div>
            ))}
          </div>

          {/* Section Lanes */}
          <div className="space-y-3 pt-1">
            {sections.map(([sectionId, sectionBlocks]) => (
              <div key={sectionId} className="flex items-center gap-3">
                {/* Section Header Column */}
                <div className="w-32 shrink-0 text-left">
                  <span className="font-mono text-xs font-bold text-foreground block truncate" title={sectionId}>
                    {sectionId}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {sectionBlocks.length} block{sectionBlocks.length > 1 ? "s" : ""}
                  </span>
                </div>

                {/* Section Timeline Track */}
                <div className="relative flex-1 h-12 bg-muted/20 border border-border/70 rounded overflow-hidden">
                  {/* Grid guideline lines */}
                  {tickMarks.map((tick, idx) => (
                    <div
                      key={idx}
                      className="absolute top-0 bottom-0 w-px bg-border/40"
                      style={{ left: `${tick.percent}%` }}
                    />
                  ))}

                  {/* Rendered Block Bars */}
                  {sectionBlocks.map((block) => {
                    const blockStartMs = new Date(block.block_start).getTime();
                    const blockEndMs = new Date(block.block_end).getTime();

                    const leftPercent = Math.max(
                      0,
                      ((blockStartMs - minTime) / totalDurationMs) * 100
                    );
                    const widthPercent = Math.max(
                      1.5,
                      ((blockEndMs - blockStartMs) / totalDurationMs) * 100
                    );

                    const isSelected = selectedBlockId === block.optimized_block_id;
                    const isIntegrated = block.is_integrated;

                    return (
                      <button
                        key={block.id}
                        onClick={() => onSelectBlock(block)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onSelectBlock(block);
                          }
                        }}
                        tabIndex={0}
                        aria-label={`Block ${block.optimized_block_id}, ${block.section_id}, ${formatDuration(block.block_duration_hrs)}, ${block.departments_involved.join(", ")}`}
                        className={`absolute top-1 bottom-1 rounded px-2 text-left transition-all cursor-pointer select-none flex flex-col justify-center overflow-hidden text-white shadow-xs focus:outline-none focus:ring-2 focus:ring-ring ${
                          isSelected
                            ? "ring-2 ring-foreground ring-offset-1 z-20 scale-[1.02]"
                            : "hover:brightness-110 z-10"
                        } ${
                          isIntegrated
                            ? "bg-gradient-to-r from-purple-700 to-indigo-600 border border-purple-400/30"
                            : "bg-gradient-to-r from-blue-700 to-sky-600 border border-blue-400/30"
                        }`}
                        style={{
                          left: `${leftPercent}%`,
                          width: `${widthPercent}%`,
                          minWidth: "60px",
                        }}
                        title={`${block.optimized_block_id} (${block.section_id})\nDuration: ${formatDuration(block.block_duration_hrs)}\nTasks: ${block.task_ids.join(", ")}\nDepts: ${block.departments_involved.join(", ")}\nRealized Priority: ${formatScore(block.realized_priority_value)}`}
                      >
                        <div className="flex items-center justify-between gap-1 w-full truncate">
                          <span className="font-mono font-bold text-[10px] truncate leading-tight">
                            {block.optimized_block_id}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[9px] opacity-90 truncate leading-tight">
                          <span>{formatDuration(block.block_duration_hrs)}</span>
                          <span>•</span>
                          <span>{block.task_ids.length} tasks</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-2.5 bg-muted/40 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Timeline visualizes OR-Tools CP-SAT solution positions</span>
        <span>
          Planning Horizon: <strong className="text-foreground">{horizonStart?.slice(0, 10) || "—"}</strong> to <strong className="text-foreground">{horizonEnd?.slice(0, 10) || "—"}</strong>
        </span>
      </div>
    </div>
  );
}
