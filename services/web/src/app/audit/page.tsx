import React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { FileText, ArrowUpRight } from "lucide-react";

export default function AuditPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Operational Audit Log"
        description="Immutable logs of planning actions, solver decisions, and multi-department sign-offs."
      />
      <EmptyState
        title="Audit & Compliance Logs"
        description="Every optimization run maintains an immutable audit trail of solver runtime parameters and approval history."
        icon={<FileText className="h-6 w-6" />}
        action={
          <Link href="/optimization">
            <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
              <span>View Run Audit Records</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        }
      />
    </div>
  );
}
