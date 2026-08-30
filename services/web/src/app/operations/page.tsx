import React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { Activity } from "lucide-react";

export default function OperationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Live Operations"
        description="Monitor daily possession execution, train speed restrictions, and section clearance."
      />
      <EmptyState
        title="Operational Possession Feed"
        description="Real-time track possession monitoring and section occupancy status feeds will be mounted here in Batch 7B."
        icon={<Activity className="h-6 w-6" />}
      />
    </div>
  );
}
