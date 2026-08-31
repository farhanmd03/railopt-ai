"use client";

import React from "react";
import { OptimizedBlock } from "@/lib/types/optimization";
import { formatDuration, formatScore } from "@/lib/utils";
import { Clock, Layers, MapPin, Sparkles, Train, Wrench } from "lucide-react";

interface WeekViewProps {
  currentWeekStart: Date; // Monday of current week
  blocks: OptimizedBlock[];
  selectedBlockId: string | null;
  onSelectBlock: (block: OptimizedBlock) => void;
}

export function WeekView({
  currentWeekStart,
  blocks,
  selectedBlockId,
  onSelectBlock,
}: WeekViewProps) {
  // Generate 7 days: Mon to Sun
  const weekDays = React.useMemo(() => {
    const days: { date: Date; dateStr: string; dayName: string; formattedDate: string; isToday: boolean }[] = [];
    const today = new Date();
    const todayStr = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}-${String(today.getUTCDate()).padStart(2, "0")}`;

    for (let i = 0; i < 7; i++) {
      const d = new Date(currentWeekStart);
      d.setUTCDate(currentWeekStart.getUTCDate() + i);

      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      const dateStr = `${year}-${month}-${day}`;

      const dayName = d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
      const formattedDate = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });

      days.push({
        date: d,
        dateStr,
        dayName,
        formattedDate,
        isToday: dateStr === todayStr,
      });
    }
    return days;
  }, [currentWeekStart]);

  // Group blocks by date (supports overnight blocks spanning across consecutive days)
  const blocksByDate = React.useMemo(() => {
    const map = new Map<string, OptimizedBlock[]>();
    weekDays.forEach((wd) => map.set(wd.dateStr, []));

    blocks.forEach((block) => {
      const startD = new Date(block.block_start);
      const endD = new Date(block.block_end);

      const startYear = startD.getUTCFullYear();
      const startMonth = String(startD.getUTCMonth() + 1).padStart(2, "0");
      const startDay = String(startD.getUTCDate()).padStart(2, "0");
      const startDateStr = `${startYear}-${startMonth}-${startDay}`;

      const endYear = endD.getUTCFullYear();
      const endMonth = String(endD.getUTCMonth() + 1).padStart(2, "0");
      const endDay = String(endD.getUTCDate()).padStart(2, "0");
      const endDateStr = `${endYear}-${endMonth}-${endDay}`;

      // Insert into start date
      if (map.has(startDateStr)) {
        map.get(startDateStr)!.push(block);
      }

      // If overnight spans into next day and differs
      if (startDateStr !== endDateStr && map.has(endDateStr)) {
        const list = map.get(endDateStr)!;
        if (!list.some((b) => b.id === block.id)) {
          list.push(block);
        }
      }
    });

    // Sort blocks by start time on each day
    map.forEach((list) => {
      list.sort((a, b) => new Date(a.block_start).getTime() - new Date(b.block_start).getTime());
    });

    return map;
  }, [weekDays, blocks]);

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3 min-w-[900px]">
        {weekDays.map((wd) => {
          const dayBlocks = blocksByDate.get(wd.dateStr) || [];

          return (
            <div
              key={wd.dateStr}
              className={`flex flex-col rounded border bg-card/60 shadow-xs min-h-[460px] ${
                wd.isToday ? "border-primary/60 ring-1 ring-primary/40 bg-primary/5" : "border-border"
              }`}
            >
              {/* Day Column Header */}
              <div
                className={`p-2.5 border-b border-border text-center rounded-t flex flex-col items-center justify-center ${
                  wd.isToday ? "bg-primary text-primary-foreground font-bold" : "bg-muted/40 text-foreground"
                }`}
              >
                <span className="text-[11px] uppercase font-bold tracking-wider opacity-90">
                  {wd.dayName}
                </span>
                <span className="text-sm font-extrabold font-mono mt-0.5">
                  {wd.formattedDate}
                </span>
                <div className="flex items-center gap-1 mt-1">
                  <span
                    className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold ${
                      wd.isToday
                        ? "bg-white/20 text-white"
                        : dayBlocks.length > 0
                        ? "bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {dayBlocks.length} {dayBlocks.length === 1 ? "Block" : "Blocks"}
                  </span>
                </div>
              </div>

              {/* Day Column Body */}
              <div className="p-2 flex-1 space-y-2.5 overflow-y-auto">
                {dayBlocks.length === 0 ? (
                  <div className="h-32 flex flex-col items-center justify-center text-center p-2 text-muted-foreground">
                    <span className="text-[11px] italic">No blocks scheduled</span>
                  </div>
                ) : (
                  dayBlocks.map((block) => {
                    const isSelected = selectedBlockId === block.optimized_block_id;
                    const isIntegrated = block.is_integrated;
                    const depts = block.departments_involved || [];

                    return (
                      <div
                        key={`${wd.dateStr}-${block.id}`}
                        onClick={() => onSelectBlock(block)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onSelectBlock(block);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label={`Block ${block.optimized_block_id}, ${block.section_id}, ${formatTime(block.block_start)} to ${formatTime(block.block_end)}`}
                        className={`p-2.5 rounded border transition-all cursor-pointer select-none text-xs space-y-2 text-left focus:outline-none focus:ring-2 focus:ring-ring ${
                          isSelected
                            ? "bg-blue-50 dark:bg-blue-950/70 border-primary ring-2 ring-primary shadow-md scale-[1.02]"
                            : "bg-card hover:bg-muted/40 hover:border-slate-400 dark:hover:border-slate-600 border-border shadow-xs"
                        }`}
                      >
                        {/* Block ID & Joint Badge */}
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono font-extrabold text-[11px] text-foreground">
                            {block.optimized_block_id}
                          </span>
                          {isIntegrated ? (
                            <span className="rounded bg-purple-100 dark:bg-purple-950 px-1.5 py-0.2 text-[9px] font-bold text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shrink-0">
                              Joint
                            </span>
                          ) : (
                            <span className="rounded bg-blue-100 dark:bg-blue-950 px-1.5 py-0.2 text-[9px] font-bold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shrink-0">
                              Single
                            </span>
                          )}
                        </div>

                        {/* Section & Time Interval */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground font-semibold">
                            <MapPin className="h-3 w-3 text-blue-600 shrink-0" />
                            <span className="truncate">{block.section_id}</span>
                          </div>

                          <div className="flex items-center gap-1 font-mono text-[10px] text-foreground bg-muted/40 px-1.5 py-0.5 rounded border border-border">
                            <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="font-semibold">
                              {formatTime(block.block_start)} → {formatTime(block.block_end)}
                            </span>
                            <span className="text-muted-foreground ml-auto">
                              ({formatDuration(block.block_duration_hrs)})
                            </span>
                          </div>
                        </div>

                        {/* Departments involved */}
                        <div className="flex flex-wrap gap-1">
                          {depts.map((d) => (
                            <span
                              key={d}
                              className={`rounded px-1.5 py-0.2 text-[9px] font-semibold border ${
                                d === "Engineering"
                                  ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                                  : d === "S&T"
                                  ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                  : "bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                              }`}
                            >
                              {d}
                            </span>
                          ))}
                        </div>

                        {/* Realized Priority & Task Count */}
                        <div className="pt-1 border-t border-border flex items-center justify-between text-[10px]">
                          <span className="text-muted-foreground">
                            {block.task_ids.length} {block.task_ids.length === 1 ? "task" : "tasks"}
                          </span>
                          <span className="font-mono font-extrabold text-blue-600 dark:text-blue-400">
                            {formatScore(block.realized_priority_value)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
