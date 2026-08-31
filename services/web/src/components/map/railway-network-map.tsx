"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Station } from "@/lib/types/station";
import { Section } from "@/lib/types/section";
import { MaintenanceTask } from "@/lib/types/maintenance";
import { CandidateBlock } from "@/lib/types/candidate-block";
import { OptimizedBlock } from "@/lib/types/optimization";
import { LayerVisibilityState } from "./map-legend";
import { MapFilterState } from "./map-filters";
import { SelectedMapEntity } from "./map-selected-detail";
import { MapPin } from "lucide-react";

const RailwayNetworkMapInner = dynamic(
  () => import("./railway-network-map-inner"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[560px] w-full rounded border border-border bg-muted/20 flex flex-col items-center justify-center space-y-3">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <span className="text-xs font-semibold text-muted-foreground">
          Initializing Howrah Division Geospatial Track Network...
        </span>
      </div>
    ),
  }
);

export interface RailwayNetworkMapProps {
  stations: Station[];
  sections: Section[];
  maintenanceTasks: MaintenanceTask[];
  candidateBlocks: CandidateBlock[];
  optimizedBlocks: OptimizedBlock[];
  layers: LayerVisibilityState;
  filters: MapFilterState;
  selectedEntity: SelectedMapEntity | null;
  onSelectEntity: (entity: SelectedMapEntity | null) => void;
  className?: string;
}

export function RailwayNetworkMap(props: RailwayNetworkMapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-[560px] w-full rounded border border-border bg-muted/20 flex flex-col items-center justify-center space-y-3">
        <MapPin className="h-8 w-8 text-muted-foreground animate-pulse" />
        <span className="text-xs font-semibold text-muted-foreground">
          Loading Railway GIS Canvas...
        </span>
      </div>
    );
  }

  return <RailwayNetworkMapInner {...props} />;
}
