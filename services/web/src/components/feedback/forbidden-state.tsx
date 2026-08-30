"use client";

import React from "react";
import Link from "next/link";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AppRole } from "@/lib/auth-config";

interface ForbiddenStateProps {
  userRoles?: AppRole[];
  requiredRoles?: AppRole[];
  moduleName?: string;
}

export function ForbiddenState({
  userRoles = [],
  requiredRoles = [],
  moduleName,
}: ForbiddenStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center rounded border border-border bg-card shadow-xs">
      <div className="flex items-center justify-center h-14 w-14 rounded-full bg-red-100 text-red-600 mb-4 ring-8 ring-red-50">
        <ShieldAlert className="h-7 w-7" />
      </div>

      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200 uppercase tracking-wider mb-2">
        <span>403 FORBIDDEN</span>
      </div>

      <h2 className="text-xl font-bold tracking-tight text-foreground">
        Access Restricted
      </h2>

      <p className="text-sm text-muted-foreground mt-2 max-w-md">
        You are authenticated but do not have permission to access{" "}
        {moduleName ? <span className="font-semibold text-foreground">{moduleName}</span> : "this operational area"}.
      </p>

      {/* Roles Breakdown */}
      <div className="my-6 p-4 rounded bg-muted/60 border border-border max-w-md w-full text-left space-y-3 text-xs">
        <div>
          <span className="font-semibold text-muted-foreground block mb-1">
            Your Assigned Roles:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {userRoles.length > 0 ? (
              userRoles.map((r) => (
                <Badge key={r} variant="neutral">
                  {r}
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground italic">No roles assigned</span>
            )}
          </div>
        </div>

        {requiredRoles.length > 0 && (
          <div>
            <span className="font-semibold text-muted-foreground block mb-1">
              Required Roles for this Module:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {requiredRoles.map((r) => (
                <Badge key={r} variant="info">
                  {r}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Link href="/dashboard">
          <Button size="sm" className="gap-2 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to Dashboard</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}
