import React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { CheckSquare } from "lucide-react";

export default function ApprovalsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Block Approvals"
        description="Multi-department authorization and human sign-off workflow for recommended maintenance possessions."
      />
      <EmptyState
        title="Possession Approval Queue"
        description="Approval workflows for transforming Candidate recommendations to Approved possessions will be available in Batch 8."
        icon={<CheckSquare className="h-6 w-6" />}
      />
    </div>
  );
}
