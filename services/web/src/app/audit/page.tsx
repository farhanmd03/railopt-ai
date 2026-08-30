import React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { FileText } from "lucide-react";

export default function AuditPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Operational Audit Log"
        description="Immutable logs of planning actions, solver decisions, and multi-department sign-offs."
      />
      <EmptyState
        title="Audit & Compliance Logs"
        description="Complete provenance and decision audit trail console will be available here in Batch 8."
        icon={<FileText className="h-6 w-6" />}
      />
    </div>
  );
}
