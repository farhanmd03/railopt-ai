"use client";

import React from "react";
import { Check, Eye, EyeOff, Layers, MapPin, Sparkles, Train, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface LayerVisibilityState {
  stations: boolean;
  sections: boolean;
  maintenance: boolean;
  candidates: boolean;
  optimized: boolean;
}

export interface LayerCounts {
  stations: number;
  sections: number;
  maintenance: number;
  candidates: number;
  optimized: number;
}

interface MapLegendProps {
  layers: LayerVisibilityState;
  counts: LayerCounts;
  onToggleLayer: (layer: keyof LayerVisibilityState) => void;
  onToggleAll: (visible: boolean) => void;
}

export function MapLegend({
  layers,
  counts,
  onToggleLayer,
  onToggleAll,
}: MapLegendProps) {
  const allVisible = Object.values(layers).every(Boolean);

  return (
    <div className="bg-card/95 backdrop-blur-xs border border-border rounded shadow-md p-3.5 space-y-3">
      <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
        <div className="flex items-center gap-1.5">
          <Layers className="h-4 w-4 text-blue-600" />
          <span className="text-xs font-bold text-foreground">Map Layers & Legend</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleAll(!allVisible)}
            className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
            title={allVisible ? "Hide all layers" : "Show all layers"}
          >
            {allVisible ? (
              <>
                <EyeOff className="h-3 w-3 mr-1" />
                <span>Hide All</span>
              </>
            ) : (
              <>
                <Eye className="h-3 w-3 mr-1" />
                <span>Show All</span>
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="space-y-1.5 text-xs">
        {/* 1. Stations Layer */}
        <label
          className={`flex items-center justify-between p-1.5 rounded transition-colors cursor-pointer select-none ${
            layers.stations ? "bg-muted/40" : "opacity-60 hover:opacity-80"
          }`}
        >
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={layers.stations}
              onChange={() => onToggleLayer("stations")}
              className="rounded border-input text-blue-600 focus:ring-ring h-3.5 w-3.5 cursor-pointer"
            />
            <div className="flex items-center gap-1.5">
              {/* Visual shape & icon */}
              <span className="h-3 w-3 rounded-full bg-slate-900 border border-white shadow-xs inline-block" />
              <span className="font-semibold text-foreground">Stations</span>
            </div>
          </div>
          <span className="font-mono text-[11px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {counts.stations}
          </span>
        </label>

        {/* 2. Railway Sections Layer */}
        <label
          className={`flex items-center justify-between p-1.5 rounded transition-colors cursor-pointer select-none ${
            layers.sections ? "bg-muted/40" : "opacity-60 hover:opacity-80"
          }`}
        >
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={layers.sections}
              onChange={() => onToggleLayer("sections")}
              className="rounded border-input text-blue-600 focus:ring-ring h-3.5 w-3.5 cursor-pointer"
            />
            <div className="flex items-center gap-1.5">
              {/* Visual track line */}
              <span className="h-1.5 w-4 rounded-full bg-slate-700 inline-block" />
              <span className="font-semibold text-foreground">Railway Sections</span>
            </div>
          </div>
          <span className="font-mono text-[11px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {counts.sections}
          </span>
        </label>

        {/* 3. Maintenance Tasks Layer */}
        <label
          className={`flex items-center justify-between p-1.5 rounded transition-colors cursor-pointer select-none ${
            layers.maintenance ? "bg-muted/40" : "opacity-60 hover:opacity-80"
          }`}
        >
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={layers.maintenance}
              onChange={() => onToggleLayer("maintenance")}
              className="rounded border-input text-red-600 focus:ring-ring h-3.5 w-3.5 cursor-pointer"
            />
            <div className="flex items-center gap-1.5">
              {/* Visual wrench marker */}
              <span className="h-3 w-3 rounded-full bg-red-600 text-white flex items-center justify-center text-[8px] font-bold">
                W
              </span>
              <span className="font-semibold text-foreground">Maintenance Tasks</span>
            </div>
          </div>
          <span className="font-mono text-[11px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 px-1.5 py-0.5 rounded border border-red-200 dark:border-red-800">
            {counts.maintenance}
          </span>
        </label>

        {/* 4. Candidate Blocks Layer */}
        <label
          className={`flex items-center justify-between p-1.5 rounded transition-colors cursor-pointer select-none ${
            layers.candidates ? "bg-muted/40" : "opacity-60 hover:opacity-80"
          }`}
        >
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={layers.candidates}
              onChange={() => onToggleLayer("candidates")}
              className="rounded border-input text-amber-600 focus:ring-ring h-3.5 w-3.5 cursor-pointer"
            />
            <div className="flex items-center gap-1.5">
              {/* Visual dashed amber block */}
              <span className="h-2.5 w-3.5 rounded border border-dashed border-amber-600 bg-amber-500/20 inline-block" />
              <span className="font-semibold text-foreground">Candidate Blocks</span>
            </div>
          </div>
          <span className="font-mono text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
            {counts.candidates}
          </span>
        </label>

        {/* 5. Optimized Blocks Layer */}
        <label
          className={`flex items-center justify-between p-1.5 rounded transition-colors cursor-pointer select-none ${
            layers.optimized ? "bg-muted/40" : "opacity-60 hover:opacity-80"
          }`}
        >
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={layers.optimized}
              onChange={() => onToggleLayer("optimized")}
              className="rounded border-input text-purple-600 focus:ring-ring h-3.5 w-3.5 cursor-pointer"
            />
            <div className="flex items-center gap-1.5">
              {/* Visual solid purple/blue glowing bar */}
              <span className="h-2.5 w-3.5 rounded bg-gradient-to-r from-purple-600 to-indigo-600 border border-purple-400 shadow-xs inline-block" />
              <span className="font-semibold text-foreground">Optimized Blocks</span>
            </div>
          </div>
          <span className="font-mono text-[11px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-800">
            {counts.optimized}
          </span>
        </label>
      </div>

      {/* Semantic Distinction Notice */}
      <div className="pt-2 border-t border-border text-[10px] text-muted-foreground space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          <span><strong>Candidate:</strong> Potential possession window</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-purple-600" />
          <span><strong>Optimized:</strong> Solver recommended block</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
          <span><strong>Approved:</strong> Requires operational clearance</span>
        </div>
      </div>
    </div>
  );
}
