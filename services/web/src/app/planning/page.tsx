import React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { Calendar } from "lucide-react";

export default function PlanningPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Corridor Planning"
        description="Corridor windows, train section occupancy, and candidate maintenance block generation."
      />
      <EmptyState
        title="Candidate Block Planning"
        description="Corridor window feasibility screening and train timetable conflict matrix will be loaded here in Batch 7B."
        icon={<Calendar className="h-6 w-6" />}
      />
    </div>
  );
}
