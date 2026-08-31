"use client";

import React, { useState } from "react";
import { OptimizedBlock } from "@/lib/types/optimization";
import { formatDuration, formatScore } from "@/lib/utils";
import { Calendar, Clock, Layers, MapPin, Sparkles, Train, Wrench } from "lucide-react";

interface MonthViewProps {
  currentMonthDate: Date; // Any date within the current month
  blocks: OptimizedBlock[];
  selectedBlockId: string | null;
  onSelectBlock: (block: OptimizedBlock) => void;
}

export function MonthView({
  currentMonthDate,
  blocks,
  selectedBlockId,
  onSelectBlock,
}: MonthViewProps) {
  const [selectedDayStr, setSelectedDayStr] = useState<string | null>(null);

  const year = currentMonthDate.getUTCFullYear();
  const month = currentMonthDate.getUTCMonth(); // 0-indexed

  // Build full grid of days for the month (including padding days for Monday start)
  const monthCalendarData = React.useMemo(() => {
    const firstDayOfMonth = new Date(Date.UTC(year, month, 1));
    const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0));

    // Day of week: 0 = Sun, 1 = Mon, ... 6 = Sat -> Convert so 0 = Mon, 6 = Sun
    let startDayOfWeek = firstDayOfMonth.getUTCDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const daysInMonth = lastDayOfMonth.getUTCDate();
    const today = new Date();
    const todayStr = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}-${String(today.getUTCDate()).padStart(2, "0")}`;

    const days: {
      dayNum: number;
      dateStr: string;
      isCurrentMonth: boolean;
      isToday: boolean;
      date: Date;
    }[] = [];

    // Previous month padding
    const prevMonthLastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dNum = prevMonthLastDay - i;
      const d = new Date(Date.UTC(year, month - 1, dNum));
      const dStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      days.push({
        dayNum: dNum,
        dateStr: dStr,
        isCurrentMonth: false,
        isToday: dStr === todayStr,
        date: d,
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(Date.UTC(year, month, i));
      const dStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      days.push({
        dayNum: i,
        dateStr: dStr,
        isCurrentMonth: true,
        isToday: dStr === todayStr,
        date: d,
      });
    }

    // Next month padding to make complete weeks (multiples of 7)
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(Date.UTC(year, month + 1, i));
      const dStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      days.push({
        dayNum: i,
        dateStr: dStr,
        isCurrentMonth: false,
        isToday: dStr === todayStr,
        date: d,
      });
    }

    return days;
  }, [year, month]);

  // Group blocks by date
  const blocksByDate = React.useMemo(() => {
    const map = new Map<string, OptimizedBlock[]>();

    blocks.forEach((block) => {
      const startD = new Date(block.block_start);
      const startYear = startD.getUTCFullYear();
      const startMonth = String(startD.getUTCMonth() + 1).padStart(2, "0");
      const startDay = String(startD.getUTCDate()).padStart(2, "0");
      const startDateStr = `${startYear}-${startMonth}-${startDay}`;

      if (!map.has(startDateStr)) {
        map.set(startDateStr, []);
      }
      map.get(startDateStr)!.push(block);
    });

    return map;
  }, [blocks]);

  // Set initial selected day to first day that has blocks if none selected
  React.useEffect(() => {
    if (!selectedDayStr) {
      const dayWithBlocks = monthCalendarData.find((d) => d.isCurrentMonth && (blocksByDate.get(d.dateStr)?.length || 0) > 0);
      if (dayWithBlocks) {
        setSelectedDayStr(dayWithBlocks.dateStr);
      }
    }
  }, [monthCalendarData, blocksByDate, selectedDayStr]);

  const activeDayBlocks = selectedDayStr ? blocksByDate.get(selectedDayStr) || [] : [];

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-4">
      {/* Month Calendar Grid */}
      <div className="bg-card border border-border rounded shadow-xs overflow-hidden">
        {/* Days of week header */}
        <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center text-xs font-bold py-2 text-foreground">
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
          <span>Sun</span>
        </div>

        {/* Month Day Cells */}
        <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-border text-xs">
          {monthCalendarData.map((day) => {
            const dayBlocks = blocksByDate.get(day.dateStr) || [];
            const isSelected = selectedDayStr === day.dateStr;
            const hasBlocks = dayBlocks.length > 0;

            // Collect unique departments on this day
            const deptsOnDay = Array.from(new Set(dayBlocks.flatMap((b) => b.departments_involved || [])));

            return (
              <div
                key={day.dateStr}
                onClick={() => setSelectedDayStr(day.dateStr)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedDayStr(day.dateStr);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`${day.dateStr}: ${dayBlocks.length} blocks scheduled`}
                className={`min-h-[85px] p-2 flex flex-col justify-between transition-colors cursor-pointer select-none focus:outline-none focus:ring-1 focus:ring-ring ${
                  !day.isCurrentMonth
                    ? "bg-muted/10 text-muted-foreground/50"
                    : isSelected
                    ? "bg-blue-50/80 dark:bg-blue-950/50 ring-2 ring-primary ring-inset"
                    : day.isToday
                    ? "bg-primary/5"
                    : "bg-card hover:bg-muted/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`font-mono text-xs font-bold ${
                      day.isToday
                        ? "h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
                        : day.isCurrentMonth
                        ? "text-foreground"
                        : "text-muted-foreground/50"
                    }`}
                  >
                    {day.dayNum}
                  </span>

                  {hasBlocks && (
                    <span className="font-mono text-[10px] font-extrabold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 px-1.5 py-0.2 rounded border border-blue-200 dark:border-blue-800">
                      {dayBlocks.length} {dayBlocks.length === 1 ? "block" : "blocks"}
                    </span>
                  )}
                </div>

                {/* Day preview dots */}
                {hasBlocks && (
                  <div className="space-y-1 mt-1">
                    <div className="flex items-center gap-1 flex-wrap">
                      {deptsOnDay.map((d) => (
                        <span
                          key={d}
                          className={`h-1.5 w-1.5 rounded-full ${
                            d === "Engineering"
                              ? "bg-amber-500"
                              : d === "S&T"
                              ? "bg-emerald-500"
                              : "bg-purple-500"
                          }`}
                          title={d}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono block truncate">
                      {formatDuration(dayBlocks.reduce((acc, b) => acc + (b.block_duration_hrs || 0), 0))} total
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day Blocks Detail Panel */}
      {selectedDayStr && (
        <div className="bg-card border border-border rounded p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-bold text-foreground">
                Scheduled Possessions for Date: <span className="font-mono">{selectedDayStr}</span>
              </h3>
            </div>
            <span className="text-xs font-semibold text-muted-foreground font-mono">
              {activeDayBlocks.length} {activeDayBlocks.length === 1 ? "Block" : "Blocks"} Scheduled
            </span>
          </div>

          {activeDayBlocks.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-xs italic">
              No maintenance possession blocks scheduled on this date.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeDayBlocks.map((block) => {
                const isSelected = selectedBlockId === block.optimized_block_id;
                const isIntegrated = block.is_integrated;
                const depts = block.departments_involved || [];

                return (
                  <div
                    key={block.id}
                    onClick={() => onSelectBlock(block)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectBlock(block);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Block ${block.optimized_block_id}, ${block.section_id}`}
                    className={`p-3 rounded border transition-all cursor-pointer select-none text-xs space-y-2 text-left focus:outline-none focus:ring-2 focus:ring-ring ${
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-950/70 border-primary ring-2 ring-primary shadow-md"
                        : "bg-muted/20 hover:bg-muted/40 border-border shadow-xs"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono font-bold text-xs text-foreground">
                        {block.optimized_block_id}
                      </span>
                      {isIntegrated ? (
                        <span className="rounded bg-purple-100 dark:bg-purple-950 px-1.5 py-0.2 text-[10px] font-bold text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          Integrated Joint
                        </span>
                      ) : (
                        <span className="rounded bg-blue-100 dark:bg-blue-950 px-1.5 py-0.2 text-[10px] font-bold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          Single Block
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground font-semibold">
                        <MapPin className="h-3 w-3 text-blue-600" />
                        <span>{block.section_id}</span>
                      </div>

                      <div className="flex items-center gap-1 font-mono text-[11px] text-foreground bg-card p-1 rounded border border-border">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span>
                          {formatTime(block.block_start)} → {formatTime(block.block_end)}
                        </span>
                        <span className="text-muted-foreground ml-auto">
                          ({formatDuration(block.block_duration_hrs)})
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {depts.map((d) => (
                        <span
                          key={d}
                          className="rounded px-1.5 py-0.2 text-[10px] font-semibold border bg-background border-border text-foreground"
                        >
                          {d}
                        </span>
                      ))}
                    </div>

                    <div className="pt-1 border-t border-border flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">
                        {block.task_ids.length} Work Orders
                      </span>
                      <span className="font-mono font-extrabold text-blue-600 dark:text-blue-400">
                        Realized: {formatScore(block.realized_priority_value)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
