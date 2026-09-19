"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, CheckCircle2, Cpu, FileSpreadsheet, Radio, Network } from "lucide-react";

interface DataSource {
  name: string;
  department: string;
  sourceType: string;
  protocol: string;
  status: "CONNECTED" | "SYNTHETIC" | "PROTOTYPE";
  description: string;
}

const DATA_SOURCES: DataSource[] = [
  {
    name: "TMS",
    department: "Engineering (P-Way)",
    sourceType: "Track Management System",
    protocol: "REST / Batch Import",
    status: "PROTOTYPE",
    description: "Track geometry, rail defects, ultrasonic flaw detections, weld records",
  },
  {
    name: "SMMS",
    department: "Signalling & Telecom",
    sourceType: "Signalling Maintenance System",
    protocol: "REST / JSON Feed",
    status: "PROTOTYPE",
    description: "Point machines, track circuits, electronic interlocking health metrics",
  },
  {
    name: "TDMS",
    department: "Traction Distribution (TRD)",
    sourceType: "Traction Distribution System",
    protocol: "OHE Telemetry / REST",
    status: "PROTOTYPE",
    description: "OHE cantilever inspections, contact wire wear, power isolator states",
  },
  {
    name: "COA / Timetable",
    department: "Operating / Control",
    sourceType: "Control Office Application",
    protocol: "Timetable Constraint Feed",
    status: "PROTOTYPE",
    description: "Train schedule paths, section headroom, freight corridor path availability",
  },
];

export function DataSourcesPanel() {
  return (
    <Card className="border-border bg-card shadow-xs">
      <CardHeader className="flex flex-row items-center justify-between pb-2 p-4">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-blue-600" />
          <CardTitle className="text-sm font-bold text-foreground">
            Enterprise Data Sources & Prototype Adapters
          </CardTitle>
        </div>
        <span className="text-[10px] uppercase font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded">
          Synthetic / Seed Ingestion
        </span>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-3">
        <p className="text-xs text-muted-foreground">
          RailOpt AI ingests multi-department maintenance requirements and operational timetable constraints via specialized departmental adapters:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {DATA_SOURCES.map((ds) => (
            <div
              key={ds.name}
              className="p-3 rounded border border-border bg-muted/20 space-y-1.5 hover:border-border/80 transition-colors text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-foreground text-xs">
                  {ds.name}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  Prototype Adapter
                </span>
              </div>
              <div className="text-[11px] font-semibold text-muted-foreground">
                {ds.department}
              </div>
              <p className="text-[10px] text-muted-foreground line-clamp-2">
                {ds.description}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
