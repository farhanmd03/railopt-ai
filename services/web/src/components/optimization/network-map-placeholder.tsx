"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Map, MapPin, Navigation, Route, Sparkles } from "lucide-react";

interface NetworkMapPlaceholderProps {
  sectionCount?: number;
  blockCount?: number;
}

export function NetworkMapPlaceholder({
  sectionCount = 0,
  blockCount = 0,
}: NetworkMapPlaceholderProps) {
  return (
    <Card className="border-border bg-card shadow-xs overflow-hidden">
      <div className="p-3.5 border-b border-border bg-muted/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Map className="h-4 w-4 text-blue-600" />
          <span className="text-xs font-bold text-foreground">
            Railway Network View (PostGIS Spatial Overlay)
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground">
          Dedicated GIS Corridor Integration Module
        </span>
      </div>

      <CardContent className="p-6 text-center space-y-4">
        <div className="mx-auto h-12 w-12 rounded-full bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 border border-blue-200 dark:border-blue-900">
          <Route className="h-6 w-6" />
        </div>

        <div className="space-y-1 max-w-md mx-auto">
          <h4 className="text-sm font-bold text-foreground">
            Spatial Corridor Visualization Interface
          </h4>
          <p className="text-xs text-muted-foreground">
            Interactive PostGIS track geometry map with real-time section possessions, signal boundaries, and corridor work zones will be integrated here in Batch 10.
          </p>
        </div>

        <div className="flex justify-center gap-4 text-xs text-muted-foreground pt-1">
          <div className="flex items-center gap-1.5 bg-muted/40 px-3 py-1 rounded border border-border">
            <MapPin className="h-3.5 w-3.5 text-blue-600" />
            <span>{sectionCount} Active Sections Mapped</span>
          </div>
          <div className="flex items-center gap-1.5 bg-muted/40 px-3 py-1 rounded border border-border">
            <Navigation className="h-3.5 w-3.5 text-purple-600" />
            <span>{blockCount} Scheduled Block Zones</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
