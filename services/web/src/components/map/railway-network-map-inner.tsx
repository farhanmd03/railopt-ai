"use client";

import React, { useEffect, useRef } from "react";
import L from "leaflet";
import { Station } from "@/lib/types/station";
import { Section } from "@/lib/types/section";
import { MaintenanceTask } from "@/lib/types/maintenance";
import { CandidateBlock } from "@/lib/types/candidate-block";
import { OptimizedBlock } from "@/lib/types/optimization";
import { LayerVisibilityState } from "./map-legend";
import { MapFilterState } from "./map-filters";
import { SelectedMapEntity } from "./map-selected-detail";
import { formatDuration, formatScore } from "@/lib/utils";

interface RailwayNetworkMapInnerProps {
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

export default function RailwayNetworkMapInner({
  stations,
  sections,
  maintenanceTasks,
  candidateBlocks,
  optimizedBlocks,
  layers,
  filters,
  selectedEntity,
  onSelectEntity,
  className = "h-[560px] w-full rounded border border-border overflow-hidden",
}: RailwayNetworkMapInnerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Layer groups for reactive toggling
  const stationsLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const sectionsLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const maintenanceLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const candidatesLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const optimizedLayerRef = useRef<L.LayerGroup>(L.layerGroup());

  // 1. Initialize Map on Mount
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Create Map with standard OSM options
    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: true,
    });

    // Add standard OpenStreetMap TileLayer with required attribution
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 18,
      minZoom: 6,
    }).addTo(map);

    // Attach Layer Groups to map
    stationsLayerRef.current.addTo(map);
    sectionsLayerRef.current.addTo(map);
    maintenanceLayerRef.current.addTo(map);
    candidatesLayerRef.current.addTo(map);
    optimizedLayerRef.current.addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Compute Viewport Bounds Dynamically from Authoritative Station Coordinates
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Filter stations that have genuine numeric latitude & longitude
    const validStationCoords: [number, number][] = stations
      .filter((s) => s.latitude != null && s.longitude != null && !isNaN(s.latitude) && !isNaN(s.longitude))
      .map((s) => [s.latitude as number, s.longitude as number]);

    if (validStationCoords.length >= 2) {
      // Dynamic bounds from real project dataset
      const bounds = L.latLngBounds(validStationCoords.map((c) => L.latLng(c[0], c[1])));
      map.fitBounds(bounds, { padding: [35, 35], maxZoom: 13 });
    } else if (validStationCoords.length === 1) {
      map.setView(validStationCoords[0], 12);
    } else {
      // Fallback viewport ONLY when dataset lacks sufficient coordinates
      map.fitBounds(
        L.latLngBounds([
          [22.5, 87.7],
          [23.5, 88.5],
        ]),
        { padding: [20, 20] }
      );
    }
  }, [stations]);

  // 3. Build Station Coordinate Lookup Map
  const stationCoordMap = React.useMemo(() => {
    const map = new Map<string, [number, number]>();
    stations.forEach((s) => {
      if (s.latitude != null && s.longitude != null && !isNaN(s.latitude) && !isNaN(s.longitude)) {
        map.set(s.station_code, [s.latitude, s.longitude]);
      }
    });
    return map;
  }, [stations]);

  // 4. Render & Update Map Layers Reactively
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing layer contents
    stationsLayerRef.current.clearLayers();
    sectionsLayerRef.current.clearLayers();
    maintenanceLayerRef.current.clearLayers();
    candidatesLayerRef.current.clearLayers();
    optimizedLayerRef.current.clearLayers();

    // Map of section coordinates for placing contextual overlays
    const sectionMidpointMap = new Map<string, [number, number]>();

    // ----------------------------------------------------
    // A. RAILWAY SECTIONS LAYER
    // ----------------------------------------------------
    if (layers.sections) {
      sections.forEach((sec) => {
        // Check filter
        if (filters.sectionId && sec.section_id !== filters.sectionId) return;

        const fromCoord = sec.from_station_code ? stationCoordMap.get(sec.from_station_code) : null;
        const toCoord = sec.to_station_code ? stationCoordMap.get(sec.to_station_code) : null;

        if (fromCoord && toCoord) {
          const latLngs: [number, number][] = [fromCoord, toCoord];
          const isSelected =
            selectedEntity?.type === "section" && selectedEntity.data.section_id === sec.section_id;

          // Store midpoint for section-level tasks/blocks
          const midLat = (fromCoord[0] + toCoord[0]) / 2;
          const midLng = (fromCoord[1] + toCoord[1]) / 2;
          sectionMidpointMap.set(sec.section_id, [midLat, midLng]);

          const polyline = L.polyline(latLngs, {
            color: isSelected ? "#1e40af" : "#334155",
            weight: isSelected ? 6 : 4,
            opacity: isSelected ? 1 : 0.8,
            dashArray: sec.electrified ? undefined : "6, 6",
          });

          polyline.bindTooltip(
            `<strong>${sec.section_id}</strong>: ${sec.section_name} (${sec.route_km ?? "—"} km)`,
            { sticky: true, direction: "top" }
          );

          polyline.on("click", (e) => {
            L.DomEvent.stopPropagation(e);
            onSelectEntity({ type: "section", data: sec });
          });

          sectionsLayerRef.current.addLayer(polyline);
        }
      });
    }

    // ----------------------------------------------------
    // B. STATIONS LAYER
    // ----------------------------------------------------
    if (layers.stations) {
      stations.forEach((st) => {
        if (st.latitude == null || st.longitude == null || isNaN(st.latitude) || isNaN(st.longitude)) return;

        const isSelected =
          selectedEntity?.type === "station" && selectedEntity.data.station_code === st.station_code;

        const iconHtml = `
          <div class="flex items-center justify-center -translate-x-1/2 -translate-y-1/2 group cursor-pointer" title="${st.station_name} (${st.station_code})">
            <div class="h-4 w-4 rounded-full border-2 ${
              isSelected ? "bg-blue-600 border-white ring-2 ring-blue-500 scale-125" : "bg-slate-900 border-white shadow-xs hover:scale-110"
            } transition-all flex items-center justify-center">
              <div class="h-1.5 w-1.5 rounded-full bg-white"></div>
            </div>
            <div class="ml-1 px-1.5 py-0.5 rounded bg-slate-950/80 text-white font-mono text-[9px] font-bold shadow-xs whitespace-nowrap pointer-events-none">
              ${st.station_code}
            </div>
          </div>
        `;

        const icon = L.divIcon({
          html: iconHtml,
          className: "custom-station-icon",
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });

        const marker = L.marker([st.latitude, st.longitude], { icon });

        marker.bindTooltip(`<strong>${st.station_name}</strong> (${st.station_code})`, {
          direction: "top",
          offset: [0, -10],
        });

        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          onSelectEntity({ type: "station", data: st });
        });

        stationsLayerRef.current.addLayer(marker);
      });
    }

    // ----------------------------------------------------
    // C. MAINTENANCE TASKS LAYER
    // ----------------------------------------------------
    if (layers.maintenance) {
      maintenanceTasks.forEach((task, idx) => {
        // Apply filters
        if (filters.sectionId && task.section_id !== filters.sectionId) return;
        if (filters.department && task.department !== filters.department) return;
        if (filters.severity && task.severity !== filters.severity) return;
        if (filters.status && task.status !== filters.status) return;

        // Determine coordinate placement from section anchor
        const taskSectionId = task.section_id || "";
        let pos = taskSectionId ? sectionMidpointMap.get(taskSectionId) : null;
        if (!pos && taskSectionId) {
          // Fallback: try finding section from sections list
          const sec = sections.find((s) => s.section_id === taskSectionId);
          if (sec && sec.from_station_code && sec.to_station_code) {
            const f = stationCoordMap.get(sec.from_station_code);
            const t = stationCoordMap.get(sec.to_station_code);
            if (f && t) {
              pos = [(f[0] + t[0]) / 2, (f[1] + t[1]) / 2];
            }
          }
        }

        if (pos) {
          // Add small jitter based on index so multiple tasks on same section don't overlap completely
          const jitterLat = ((idx % 5) - 2) * 0.003;
          const jitterLng = (((idx * 3) % 5) - 2) * 0.003;
          const taskCoord: [number, number] = [pos[0] + jitterLat, pos[1] + jitterLng];

          const isSelected =
            selectedEntity?.type === "maintenance" && selectedEntity.data.task_id === task.task_id;

          const isCritical = task.severity === "CRITICAL" || (task.priority_score && task.priority_score >= 70);

          const iconHtml = `
            <div class="flex items-center justify-center -translate-x-1/2 -translate-y-1/2 cursor-pointer" title="Task ${task.task_id} (${task.department})">
              <div class="h-5 w-5 rounded-full flex items-center justify-center text-white font-bold text-[10px] shadow-md border-2 border-white transition-all ${
                isSelected
                  ? "ring-2 ring-primary scale-125 " + (isCritical ? "bg-red-700" : "bg-blue-700")
                  : isCritical
                  ? "bg-red-600 hover:scale-110"
                  : "bg-amber-600 hover:scale-110"
              }">
                W
              </div>
            </div>
          `;

          const icon = L.divIcon({
            html: iconHtml,
            className: "custom-maintenance-icon",
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          });

          const marker = L.marker(taskCoord, { icon });

          marker.bindTooltip(
            `<strong>Work Order ${task.task_id}</strong><br/>${task.department} • Score: ${formatScore(task.priority_score)}`,
            { direction: "top", offset: [0, -10] }
          );

          marker.on("click", (e) => {
            L.DomEvent.stopPropagation(e);
            onSelectEntity({ type: "maintenance", data: task });
          });

          maintenanceLayerRef.current.addLayer(marker);
        }
      });
    }

    // ----------------------------------------------------
    // D. CANDIDATE BLOCKS LAYER
    // ----------------------------------------------------
    if (layers.candidates) {
      candidateBlocks.forEach((cand, idx) => {
        if (filters.sectionId && cand.section_id !== filters.sectionId) return;
        if (filters.department && !cand.departments_involved.includes(filters.department)) return;
        if (filters.integratedOnly && cand.departments_involved.length < 2) return;

        let pos = sectionMidpointMap.get(cand.section_id);
        if (!pos) {
          const sec = sections.find((s) => s.section_id === cand.section_id);
          if (sec && sec.from_station_code && sec.to_station_code) {
            const f = stationCoordMap.get(sec.from_station_code);
            const t = stationCoordMap.get(sec.to_station_code);
            if (f && t) {
              pos = [(f[0] + t[0]) / 2, (f[1] + t[1]) / 2];
            }
          }
        }

        if (pos) {
          const jitterLat = ((idx % 4) - 1.5) * 0.004 + 0.003;
          const jitterLng = (((idx * 2) % 4) - 1.5) * 0.004 - 0.003;
          const candCoord: [number, number] = [pos[0] + jitterLat, pos[1] + jitterLng];

          const isSelected =
            selectedEntity?.type === "candidate" && selectedEntity.data.candidate_id === cand.candidate_id;

          const iconHtml = `
            <div class="flex items-center justify-center -translate-x-1/2 -translate-y-1/2 cursor-pointer" title="Candidate ${cand.candidate_id}">
              <div class="px-2 py-0.5 rounded border border-dashed border-amber-600 bg-amber-500/30 text-amber-900 dark:text-amber-100 font-mono text-[9px] font-bold shadow-xs whitespace-nowrap transition-all ${
                isSelected ? "ring-2 ring-amber-500 scale-125 bg-amber-500/60" : "hover:scale-105"
              }">
                ${cand.candidate_id}
              </div>
            </div>
          `;

          const icon = L.divIcon({
            html: iconHtml,
            className: "custom-candidate-icon",
            iconSize: [60, 20],
            iconAnchor: [30, 10],
          });

          const marker = L.marker(candCoord, { icon });

          marker.bindTooltip(
            `<strong>Candidate Window ${cand.candidate_id}</strong><br/>${cand.section_id} • ${formatDuration(cand.required_duration_hrs || cand.block_duration_hrs)}`,
            { direction: "top", offset: [0, -10] }
          );

          marker.on("click", (e) => {
            L.DomEvent.stopPropagation(e);
            onSelectEntity({ type: "candidate", data: cand });
          });

          candidatesLayerRef.current.addLayer(marker);
        }
      });
    }

    // ----------------------------------------------------
    // E. OPTIMIZED BLOCKS LAYER
    // ----------------------------------------------------
    if (layers.optimized) {
      optimizedBlocks.forEach((opt, idx) => {
        if (filters.sectionId && opt.section_id !== filters.sectionId) return;
        if (filters.department && !opt.departments_involved.includes(filters.department)) return;
        if (filters.integratedOnly && !opt.is_integrated) return;
        if (filters.runId && opt.optimization_run_id.toString() !== filters.runId) return;

        let pos = sectionMidpointMap.get(opt.section_id);
        if (!pos) {
          const sec = sections.find((s) => s.section_id === opt.section_id);
          if (sec && sec.from_station_code && sec.to_station_code) {
            const f = stationCoordMap.get(sec.from_station_code);
            const t = stationCoordMap.get(sec.to_station_code);
            if (f && t) {
              pos = [(f[0] + t[0]) / 2, (f[1] + t[1]) / 2];
            }
          }
        }

        if (pos) {
          const jitterLat = ((idx % 3) - 1) * 0.005 - 0.004;
          const jitterLng = (((idx * 2) % 3) - 1) * 0.005 + 0.004;
          const optCoord: [number, number] = [pos[0] + jitterLat, pos[1] + jitterLng];

          const isSelected =
            selectedEntity?.type === "optimized" && selectedEntity.data.optimized_block_id === opt.optimized_block_id;

          const isIntegrated = opt.is_integrated;

          const iconHtml = `
            <div class="flex items-center justify-center -translate-x-1/2 -translate-y-1/2 cursor-pointer" title="Optimized Block ${opt.optimized_block_id}">
              <div class="px-2.5 py-1 rounded text-white font-mono text-[10px] font-extrabold shadow-md border border-white/40 whitespace-nowrap transition-all ${
                isSelected
                  ? "ring-2 ring-primary scale-125 shadow-lg " + (isIntegrated ? "bg-gradient-to-r from-purple-800 to-indigo-700" : "bg-gradient-to-r from-blue-800 to-sky-700")
                  : isIntegrated
                  ? "bg-gradient-to-r from-purple-600 to-indigo-600 hover:scale-110"
                  : "bg-gradient-to-r from-blue-600 to-sky-600 hover:scale-110"
              }">
                ${opt.optimized_block_id}
              </div>
            </div>
          `;

          const icon = L.divIcon({
            html: iconHtml,
            className: "custom-optimized-icon",
            iconSize: [80, 24],
            iconAnchor: [40, 12],
          });

          const marker = L.marker(optCoord, { icon });

          marker.bindTooltip(
            `<strong>Optimized Block: ${opt.optimized_block_id}</strong><br/>${opt.section_id} • Realized Priority: ${formatScore(opt.realized_priority_value)}`,
            { direction: "top", offset: [0, -10] }
          );

          marker.on("click", (e) => {
            L.DomEvent.stopPropagation(e);
            onSelectEntity({ type: "optimized", data: opt });
          });

          optimizedLayerRef.current.addLayer(marker);
        }
      });
    }
  }, [
    stations,
    sections,
    maintenanceTasks,
    candidateBlocks,
    optimizedBlocks,
    layers,
    filters,
    selectedEntity,
    stationCoordMap,
    onSelectEntity,
  ]);

  return <div ref={mapContainerRef} className={className} />;
}
