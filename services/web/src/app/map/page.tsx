import React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { MapPin } from "lucide-react";

export default function MapPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="GIS Network Map"
        description="Geospatial visualization of Howrah Division sections, stations, and active maintenance blocks."
      />
      <EmptyState
        title="Geospatial Track Layout"
        description="Interactive PostGIS-powered railway corridor and section map will be integrated in Batch 8."
        icon={<MapPin className="h-6 w-6" />}
      />
    </div>
  );
}
