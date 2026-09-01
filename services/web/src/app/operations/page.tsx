import React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { Activity, ArrowUpRight } from "lucide-react";

export default function OperationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Live Operations"
        description="Monitor daily possession execution, train speed restrictions, and section clearance."
      />
      <EmptyState
        title="Operational Possession Feed"
        description="Real-time track possession monitoring and section occupancy status feeds are integrated with the Railway Map workspace."
        icon={<Activity className="h-6 w-6" />}
        action={
          <Link href="/map">
            <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
              <span>Open Railway Network Map</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        }
      />
    </div>
  );
}
