"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { getStations } from "@/lib/api/stations";
import { getSections } from "@/lib/api/sections";
import { getMaintenanceTasks } from "@/lib/api/maintenance";
import { getCandidateBlocks } from "@/lib/api/candidate-blocks";
import { getOptimizationRuns, getOptimizedBlocks } from "@/lib/api/optimization";
import { RailwayNetworkMap } from "@/components/map/railway-network-map";
import { MapLegend, LayerVisibilityState, LayerCounts } from "@/components/map/map-legend";
import { MapFilters, MapFilterState } from "@/components/map/map-filters";
import { MapSelectedDetail, SelectedMapEntity } from "@/components/map/map-selected-detail";
import { Layers, MapPin, Sparkles, Train, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";

function MapPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // URL query params
  const paramSection = searchParams.get("section") || "";
  const paramRun = searchParams.get("run") || "";

  // Filter state
  const [filters, setFilters] = useState<MapFilterState>({
    sectionId: paramSection,
    department: "",
    severity: "",
    status: "",
    integratedOnly: false,
    runId: paramRun,
  });

  // Layer visibility state
  const [layers, setLayers] = useState<LayerVisibilityState>({
    stations: true,
    sections: true,
    maintenance: true,
    candidates: true,
    optimized: true,
  });

  // Selected map entity for detail panel
  const [selectedEntity, setSelectedEntity] = useState<SelectedMapEntity | null>(null);

  // Sync state if URL params change
  useEffect(() => {
    if (paramSection || paramRun) {
      setFilters((prev) => ({
        ...prev,
        sectionId: paramSection || prev.sectionId,
        runId: paramRun || prev.runId,
      }));
    }
  }, [paramSection, paramRun]);

  // 1. Fetch Stations
  const stationsQuery = useQuery({
    queryKey: ["map-stations"],
    queryFn: () => getStations({ page_size: 100 }),
  });

  // 2. Fetch Sections
  const sectionsQuery = useQuery({
    queryKey: ["map-sections"],
    queryFn: () => getSections(),
  });

  // 3. Fetch Maintenance Tasks
  const maintenanceQuery = useQuery({
    queryKey: ["map-maintenance"],
    queryFn: () => getMaintenanceTasks({ page_size: 100 }),
  });

  // 4. Fetch Candidate Blocks
  const candidatesQuery = useQuery({
    queryKey: ["map-candidates"],
    queryFn: () => getCandidateBlocks({ page_size: 100 }),
  });

  // 5. Fetch Optimization Runs
  const runsQuery = useQuery({
    queryKey: ["map-runs"],
    queryFn: () => getOptimizationRuns({ page_size: 10 }),
  });

  // Determine active run ID for fetching optimized blocks
  const effectiveRunId =
    filters.runId ||
    (runsQuery.data?.items && runsQuery.data.items.length > 0
      ? runsQuery.data.items[0].id.toString()
      : "1");

  // 6. Fetch Optimized Blocks for current run
  const optimizedBlocksQuery = useQuery({
    queryKey: ["map-optimized-blocks", effectiveRunId],
    queryFn: () => getOptimizedBlocks(effectiveRunId, { page_size: 100 }),
    enabled: !!effectiveRunId,
  });

  // Computed raw items
  const stations = useMemo(() => stationsQuery.data?.items || [], [stationsQuery.data]);
  const sections = useMemo(() => sectionsQuery.data?.items || [], [sectionsQuery.data]);
  const maintenanceTasks = useMemo(
    () => maintenanceQuery.data?.items || [],
    [maintenanceQuery.data]
  );
  const candidateBlocks = useMemo(
    () => candidatesQuery.data?.items || [],
    [candidatesQuery.data]
  );
  const optimizedBlocks = useMemo(
    () => optimizedBlocksQuery.data?.items || [],
    [optimizedBlocksQuery.data]
  );

  // Available sections & runs for filters
  const availableSections = useMemo(
    () =>
      sections.map((s) => ({
        section_id: s.section_id,
        section_name: s.section_name,
      })),
    [sections]
  );

  const availableRuns = useMemo(
    () =>
      (runsQuery.data?.items || []).map((r) => ({
        id: r.id,
        run_id: r.run_id,
        solver_status: r.solver_status,
      })),
    [runsQuery.data]
  );

  // Filtered counts for Legend badges
  const layerCounts: LayerCounts = useMemo(() => {
    return {
      stations: stations.filter((s) => s.latitude != null && s.longitude != null).length,
      sections: sections.filter(
        (s) => !filters.sectionId || s.section_id === filters.sectionId
      ).length,
      maintenance: maintenanceTasks.filter((t) => {
        if (filters.sectionId && t.section_id !== filters.sectionId) return false;
        if (filters.department && t.department !== filters.department) return false;
        if (filters.severity && t.severity !== filters.severity) return false;
        if (filters.status && t.status !== filters.status) return false;
        return true;
      }).length,
      candidates: candidateBlocks.filter((c) => {
        if (filters.sectionId && c.section_id !== filters.sectionId) return false;
        if (filters.department && !c.departments_involved.includes(filters.department))
          return false;
        if (filters.integratedOnly && c.departments_involved.length < 2) return false;
        return true;
      }).length,
      optimized: optimizedBlocks.filter((o) => {
        if (filters.sectionId && o.section_id !== filters.sectionId) return false;
        if (filters.department && !o.departments_involved.includes(filters.department))
          return false;
        if (filters.integratedOnly && !o.is_integrated) return false;
        if (filters.runId && o.optimization_run_id.toString() !== filters.runId)
          return false;
        return true;
      }).length,
    };
  }, [stations, sections, maintenanceTasks, candidateBlocks, optimizedBlocks, filters]);

  // Handlers
  const handleToggleLayer = (layer: keyof LayerVisibilityState) => {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  const handleToggleAllLayers = (visible: boolean) => {
    setLayers({
      stations: visible,
      sections: visible,
      maintenance: visible,
      candidates: visible,
      optimized: visible,
    });
  };

  const handleResetFilters = () => {
    setFilters({
      sectionId: "",
      department: "",
      severity: "",
      status: "",
      integratedOnly: false,
      runId: "",
    });
  };

  const isLoading =
    stationsQuery.isLoading ||
    sectionsQuery.isLoading ||
    maintenanceQuery.isLoading;

  const isError =
    stationsQuery.isError || sectionsQuery.isError || maintenanceQuery.isError;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Interactive Railway Network Map"
          description="Geospatial track topology and corridor maintenance planning map."
        />
        <LoadingState message="Loading Howrah Division stations, sections, and spatial assets..." />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Interactive Railway Network Map"
          description="Geospatial track topology and corridor maintenance planning map."
        />
        <ErrorState
          title="Failed to Load GIS Network Data"
          message="Could not retrieve spatial stations or sections from railway dataset."
          onRetry={() => {
            stationsQuery.refetch();
            sectionsQuery.refetch();
            maintenanceQuery.refetch();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 1. Page Header with Division Tags */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-3 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-900 text-white dark:bg-slate-800 px-2.5 py-0.5 rounded text-xs font-bold tracking-wider">
              <Train className="h-3.5 w-3.5 text-blue-400" />
              <span>HOWRAH DIVISION (HWH)</span>
            </div>
            <span className="rounded px-2 py-0.5 uppercase tracking-wider text-[11px] font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900">
              Eastern Railway
            </span>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded border border-border">
              <MapPin className="h-3 w-3 text-blue-600" />
              <span>Geospatial Corridor Network</span>
            </div>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Interactive Railway Network Map
          </h1>
          <p className="text-xs text-muted-foreground">
            Geospatial visualization of track sections, stations, active work orders, candidate possession windows, and optimized blocks.
          </p>
        </div>

        {/* Quick KPI count badge strip */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-2.5 py-1 bg-card border border-border rounded text-xs">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase block">
              Stations
            </span>
            <span className="font-mono font-bold text-foreground">
              {layerCounts.stations}
            </span>
          </div>
          <div className="px-2.5 py-1 bg-card border border-border rounded text-xs">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase block">
              Sections
            </span>
            <span className="font-mono font-bold text-foreground">
              {layerCounts.sections}
            </span>
          </div>
          <div className="px-2.5 py-1 bg-card border border-border rounded text-xs">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase block">
              Work Orders
            </span>
            <span className="font-mono font-bold text-red-600 dark:text-red-400">
              {layerCounts.maintenance}
            </span>
          </div>
          <div className="px-2.5 py-1 bg-card border border-border rounded text-xs">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase block">
              Candidates
            </span>
            <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
              {layerCounts.candidates}
            </span>
          </div>
          <div className="px-2.5 py-1 bg-card border border-border rounded text-xs">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase block">
              Optimized
            </span>
            <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
              {layerCounts.optimized}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Filters Bar */}
      <MapFilters
        filters={filters}
        onFilterChange={setFilters}
        onResetFilters={handleResetFilters}
        availableSections={availableSections}
        availableRuns={availableRuns}
      />

      {/* 3. Main Split View: Map + Legend + Selected Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Map & Legend Column (8 of 12 cols on desktop) */}
        <div className="lg:col-span-8 space-y-3">
          <div className="relative">
            <RailwayNetworkMap
              stations={stations}
              sections={sections}
              maintenanceTasks={maintenanceTasks}
              candidateBlocks={candidateBlocks}
              optimizedBlocks={optimizedBlocks}
              layers={layers}
              filters={filters}
              selectedEntity={selectedEntity}
              onSelectEntity={setSelectedEntity}
              className="h-[580px] w-full rounded border border-border overflow-hidden shadow-xs"
            />
          </div>

          {/* Legend Strip below or floating */}
          <MapLegend
            layers={layers}
            counts={layerCounts}
            onToggleLayer={handleToggleLayer}
            onToggleAll={handleToggleAllLayers}
          />
        </div>

        {/* Selected Item Detail Panel (4 of 12 cols on desktop) */}
        <div className="lg:col-span-4 h-full min-h-[580px]">
          <MapSelectedDetail
            selection={selectedEntity}
            onClearSelection={() => setSelectedEntity(null)}
          />
        </div>
      </div>
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <PageHeader
            title="Interactive Railway Network Map"
            description="Geospatial track topology and corridor maintenance planning map."
          />
          <LoadingState message="Initializing Map Workspace..." />
        </div>
      }
    >
      <MapPageContent />
    </Suspense>
  );
}
