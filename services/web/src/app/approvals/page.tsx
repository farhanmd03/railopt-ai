import React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { CheckSquare, ArrowUpRight } from "lucide-react";

export default function ApprovalsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Block Approvals"
        description="Multi-department authorization and human sign-off workflow for recommended maintenance possessions."
      />
      <EmptyState
        title="Possession Approval Queue"
        description="Human review workflows and divisional approvals are conducted directly on active Optimization Plans."
        icon={<CheckSquare className="h-6 w-6" />}
        action={
          <Link href="/optimization">
            <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
              <span>Review Optimization Plans</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        }
      />
    </div>
  );
}
