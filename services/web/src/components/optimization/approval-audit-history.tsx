"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { getOptimizationRunAuditTrail } from "@/lib/api/optimization";
import { AuditLog } from "@/lib/types/audit";
import { formatDateTime } from "@/lib/utils";
import {
  CheckCircle2,
  Clock,
  FileCheck2,
  History,
  ShieldAlert,
  ShieldCheck,
  User as UserIcon,
  XCircle,
} from "lucide-react";

interface ApprovalAuditHistoryProps {
  runId: string | number;
}

export function ApprovalAuditHistory({ runId }: ApprovalAuditHistoryProps) {
  const auditQuery = useQuery({
    queryKey: ["optimization-run-audit-trail", runId],
    queryFn: () => getOptimizationRunAuditTrail(runId),
    enabled: !!runId,
  });

  const auditLogs: AuditLog[] = auditQuery.data?.items || [];

  return (
    <div className="bg-card border border-border rounded p-4 shadow-xs space-y-3">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-blue-600" />
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
            Approval History & Audit Trail
          </h3>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground">
          {auditLogs.length} {auditLogs.length === 1 ? "Audit Event" : "Audit Events"} Recorded
        </span>
      </div>

      {auditQuery.isLoading ? (
        <div className="p-4 text-center text-xs text-muted-foreground italic">
          Loading immutable audit trail...
        </div>
      ) : auditLogs.length === 0 ? (
        <div className="p-4 text-center text-xs text-muted-foreground italic bg-muted/20 rounded border border-border">
          No workflow actions recorded yet. Plan is in initial DRAFT state.
        </div>
      ) : (
        <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
          {auditLogs.map((log) => {
            const isApproved = log.action === "APPROVED";
            const isRejected = log.action === "REJECTED";
            const isSubmitted = log.action === "SUBMITTED";

            return (
              <div key={log.id} className="relative space-y-1 text-xs">
                {/* Timeline node icon */}
                <div
                  className={`absolute -left-6 top-0.5 h-5 w-5 rounded-full flex items-center justify-center border shadow-xs ${
                    isApproved
                      ? "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
                      : isRejected
                      ? "bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800"
                      : "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
                  }`}
                >
                  {isApproved && <CheckCircle2 className="h-3 w-3" />}
                  {isRejected && <XCircle className="h-3 w-3" />}
                  {isSubmitted && <Clock className="h-3 w-3" />}
                </div>

                {/* Event header */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-bold px-1.5 py-0.2 rounded text-[10px] uppercase tracking-wider ${
                        isApproved
                          ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200"
                          : isRejected
                          ? "bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-200"
                          : "bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200"
                      }`}
                    >
                      {log.action}
                    </span>
                    <span className="font-mono text-muted-foreground">•</span>
                    <span className="flex items-center gap-1 font-semibold text-foreground">
                      <UserIcon className="h-3 w-3 text-muted-foreground" />
                      {log.user_id || "System"}
                    </span>
                  </div>

                  <span className="text-[10px] font-mono text-muted-foreground">
                    {formatDateTime(log.timestamp)}
                  </span>
                </div>

                {/* Event details / comment */}
                {log.details && (
                  <p className="text-foreground text-[11px] bg-muted/30 p-2 rounded border border-border">
                    {log.details}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
