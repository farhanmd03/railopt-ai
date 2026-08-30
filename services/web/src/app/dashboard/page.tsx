import React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { SeverityBadge } from "@/components/status/severity-badge";
import { FeasibilityBadge } from "@/components/status/feasibility-badge";
import { SolverStatusBadge } from "@/components/status/solver-status-badge";
import { ApprovalBadge } from "@/components/status/approval-badge";
import { Activity, Cpu, Wrench, Calendar, ShieldCheck, CheckCircle2 } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Operational Dashboard"
        description="Unified railway maintenance planning and corridor optimization control center for Howrah Division (Eastern Railway)."
        badge={
          <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            <span>OPERATIONAL</span>
          </span>
        }
      />

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
              Active Work Orders
            </CardTitle>
            <Wrench className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">53</div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Engineering, S&T, and TRD
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
              Corridor Windows
            </CardTitle>
            <Calendar className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">320</div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Evaluated across 9 sections
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
              Optimizer Status
            </CardTitle>
            <Cpu className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mt-1">
              <SolverStatusBadge status="OPTIMAL" />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              CP-SAT solver initialized
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
              Integrated Efficiency
            </CardTitle>
            <Activity className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">78.9%</div>
            <p className="text-[11px] text-muted-foreground mt-1">
              15 cross-department blocks
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Railway Operations Design System Status Showcase */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-blue-600" />
            <span>Railway Operations Design System — Domain Status System</span>
          </CardTitle>
          <CardDescription>
            High-contrast, accessible visual tokens for maintenance severity, feasibility, CP-SAT solver results, and possession approvals.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-2">
          {/* Defect Severity */}
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
              1. Defect Severity Bands
            </div>
            <div className="flex flex-wrap gap-2">
              <SeverityBadge severity="Critical" />
              <SeverityBadge severity="High" />
              <SeverityBadge severity="Medium" />
              <SeverityBadge severity="Low" />
            </div>
          </div>

          {/* Block Feasibility */}
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
              2. Candidate Block Feasibility
            </div>
            <div className="flex flex-wrap gap-2">
              <FeasibilityBadge status="FEASIBLE" />
              <FeasibilityBadge status="TRAIN_CONFLICT" />
              <FeasibilityBadge status="DURATION_INSUFFICIENT" />
              <FeasibilityBadge status="BLOCKED" />
            </div>
          </div>

          {/* Solver Status */}
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
              3. CP-SAT Solver Status (Mathematical Formulation)
            </div>
            <div className="flex flex-wrap gap-2">
              <SolverStatusBadge status="OPTIMAL" />
              <SolverStatusBadge status="FEASIBLE" />
              <SolverStatusBadge status="INFEASIBLE" />
              <SolverStatusBadge status="UNKNOWN" />
            </div>
          </div>

          {/* Approval State Separation */}
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
              4. Possession Approval Lifecycle (Human Authority)
            </div>
            <div className="flex flex-wrap gap-2">
              <ApprovalBadge status="Candidate" />
              <ApprovalBadge status="Approved" />
              <ApprovalBadge status="Pending" />
              <ApprovalBadge status="Rejected" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
