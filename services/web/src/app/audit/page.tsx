"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { apiGet } from "@/lib/api-client";
import { AuditLog, AuditLogListResponse } from "@/lib/types/audit";
import { formatDateTime } from "@/lib/utils";
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  Clock,
  User,
  Activity,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const ACTION_COLORS: Record<string, string> = {
  SUBMITTED: "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  APPROVED: "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  REJECTED: "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
  NEGOTIATION: "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
};

function getActionColor(action: string): string {
  return ACTION_COLORS[action] || "bg-muted text-muted-foreground border-border";
}

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [entityFilter, setEntityFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const pageSize = 25;

  const auditQuery = useQuery({
    queryKey: ["audit-logs", page, entityFilter, actionFilter],
    queryFn: () => {
      const params: Record<string, string | number> = {
        page,
        page_size: pageSize,
      };
      if (entityFilter) params.entity_type = entityFilter;
      if (actionFilter) params.action = actionFilter;
      return apiGet<AuditLogListResponse>("/api/v1/audit/logs", params);
    },
  });

  const logs = auditQuery.data?.items || [];
  const total = auditQuery.data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operational Audit Log"
        description="Immutable logs of planning actions, solver decisions, and multi-department sign-offs."
      />

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground">Filters:</span>
        </div>

        <select
          value={entityFilter}
          onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
          className="rounded border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
        >
          <option value="">All Entity Types</option>
          <option value="OptimizationRun">Optimization Run</option>
          <option value="OptimizedBlock">Optimized Block</option>
          <option value="MaintenanceTask">Maintenance Task</option>
          <option value="Notification">Notification</option>
          <option value="PossessionOutcome">Possession Outcome</option>
        </select>

        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          className="rounded border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
        >
          <option value="">All Actions</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="NEGOTIATION">Negotiation</option>
          <option value="CREATED">Created</option>
          <option value="UPDATED">Updated</option>
        </select>

        <span className="text-[11px] text-muted-foreground ml-auto">
          {total} total {total === 1 ? "entry" : "entries"}
        </span>
      </div>

      {/* Audit Table */}
      {auditQuery.isLoading ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Loading audit records...
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center space-y-2">
          <FileText className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-sm font-semibold text-foreground">No audit records found</p>
          <p className="text-xs text-muted-foreground">
            Audit entries are automatically created when optimization runs, approvals, negotiations, and possession outcomes are recorded.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-3 py-2.5 text-left font-bold text-muted-foreground uppercase text-[10px] tracking-wider">
                    <div className="flex items-center gap-1"><Clock className="h-3 w-3" /> Timestamp</div>
                  </th>
                  <th className="px-3 py-2.5 text-left font-bold text-muted-foreground uppercase text-[10px] tracking-wider">
                    <div className="flex items-center gap-1"><Activity className="h-3 w-3" /> Action</div>
                  </th>
                  <th className="px-3 py-2.5 text-left font-bold text-muted-foreground uppercase text-[10px] tracking-wider">
                    Entity
                  </th>
                  <th className="px-3 py-2.5 text-left font-bold text-muted-foreground uppercase text-[10px] tracking-wider">
                    <div className="flex items-center gap-1"><User className="h-3 w-3" /> Actor</div>
                  </th>
                  <th className="px-3 py-2.5 text-left font-bold text-muted-foreground uppercase text-[10px] tracking-wider">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2.5 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                      {formatDateTime(log.timestamp)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold border ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="space-y-0.5">
                        <span className="text-[11px] font-semibold text-foreground block">
                          {log.entity_type || "—"}
                        </span>
                        {log.entity_id && (
                          <span className="text-[10px] font-mono text-muted-foreground block">
                            ID: {log.entity_id}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-foreground">
                      {log.user_id || "System"}
                    </td>
                    <td className="px-3 py-2.5 max-w-xs">
                      <span className="text-[11px] text-muted-foreground line-clamp-2">
                        {log.details || "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-3 py-2.5 border-t border-border bg-muted/20">
            <span className="text-[11px] text-muted-foreground">
              Page {page} of {totalPages}
            </span>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-7 px-2 text-xs"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="h-7 px-2 text-xs"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Compliance Notice */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200">
        <Shield className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block">Immutable Audit Trail</span>
          <span className="text-[11px]">
            All records are append-only and cannot be modified or deleted. This log supports regulatory compliance and operational transparency for Indian Railways possession planning.
          </span>
        </div>
      </div>
    </div>
  );
}
