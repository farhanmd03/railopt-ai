"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "react-oidc-context";
import { buildAuthUser } from "@/lib/auth-config";
import {
  AdjustmentCategory,
  NegotiationAction,
  NegotiationLog,
  NegotiationRequest,
  OptimizedBlock,
} from "@/lib/types/optimization";
import * as optimizationApi from "@/lib/api/optimization";
import { formatDateTime, formatDuration, formatScore } from "@/lib/utils";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  History,
  Layers,
  MapPin,
  MessageSquare,
  Send,
  SlidersHorizontal,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Train,
  Wrench,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExplainButton } from "@/components/explainability/explain-button";
import { SourceBadge } from "@/components/optimization/source-badge";
import { PossessionOutcomePanel } from "@/components/optimization/possession-outcome-panel";


interface OptimizedBlockDetailDrawerProps {
  block: OptimizedBlock | null;
  isOpen: boolean;
  onClose: () => void;
}

export function OptimizedBlockDetailDrawer({
  block,
  isOpen,
  onClose,
}: OptimizedBlockDetailDrawerProps) {
  const auth = useAuth();
  const user = useMemo(() => buildAuthUser(auth.user), [auth.user]);

  const isNegotiator = useMemo(() => {
    if (!user) return false;
    return user.roles.some((r) =>
      ["ENGINEERING", "SNT", "TRD", "ADMIN"].includes(r)
    );
  }, [user]);

  const defaultDept = useMemo(() => {
    if (!user) return "ENGINEERING";
    if (user.roles.includes("ENGINEERING")) return "ENGINEERING";
    if (user.roles.includes("SNT")) return "SNT";
    if (user.roles.includes("TRD")) return "TRD";
    return "ENGINEERING";
  }, [user]);

  const [selectedDept, setSelectedDept] = useState<string>("ENGINEERING");
  const [action, setAction] = useState<NegotiationAction>("ACCEPT");
  const [adjustmentCategory, setAdjustmentCategory] =
    useState<AdjustmentCategory>("TIME_CHANGE");
  const [adjustmentValue, setAdjustmentValue] = useState<string>("");
  const [adjustmentReason, setAdjustmentReason] = useState<string>("");
  const [comment, setComment] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [negotiations, setNegotiations] = useState<NegotiationLog[]>([]);
  const [isLoadingNegotiations, setIsLoadingNegotiations] = useState(false);

  const [readiness, setReadiness] = useState<optimizationApi.PossessionReadiness | null>(null);
  const [isLoadingReadiness, setIsLoadingReadiness] = useState(false);
  const [readinessError, setReadinessError] = useState(false);

  const fetchNegotiations = React.useCallback(async () => {
    if (!block) return;
    try {
      setIsLoadingNegotiations(true);
      const data = await optimizationApi.getBlockNegotiations(block.id);
      setNegotiations(data || []);
    } catch {
      // Gracefully handle query error
    } finally {
      setIsLoadingNegotiations(false);
    }
  }, [block?.id]);

  useEffect(() => {
    if (isOpen && block) {
      fetchNegotiations();
    }
  }, [isOpen, block?.id, fetchNegotiations]);

  useEffect(() => {
    if (!isOpen || !block) return;
    let isMounted = true;
    setIsLoadingReadiness(true);
    setReadinessError(false);
    optimizationApi
      .getBlockReadiness(block.id)
      .then((res) => {
        if (isMounted) setReadiness(res);
      })
      .catch(() => {
        if (isMounted) setReadinessError(true);
      })
      .finally(() => {
        if (isMounted) setIsLoadingReadiness(false);
      });
    return () => {
      isMounted = false;
    };
  }, [isOpen, block?.id]);

  useEffect(() => {
    if (defaultDept) {
      setSelectedDept(defaultDept);
    }
  }, [defaultDept]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleSubmitNegotiation = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMessage(null);
    if (!block) return;

    if (action === "ADJUST") {
      if (!adjustmentValue.trim() || !adjustmentReason.trim()) {
        setFeedbackMessage({
          type: "error",
          text: "Please provide both adjustment value and reason.",
        });
        return;
      }
    }

    const payload: NegotiationRequest = {
      department: selectedDept,
      action: action,
      comment: comment.trim() || null,
      adjustment_category: action === "ADJUST" ? adjustmentCategory : null,
      adjustment_payload:
        action === "ADJUST"
          ? {
              value: adjustmentValue.trim(),
              reason: adjustmentReason.trim(),
            }
          : null,
    };

    try {
      setIsSubmitting(true);
      await optimizationApi.negotiateBlock(block.id, payload);
      setFeedbackMessage({
        type: "success",
        text: "Department negotiation action recorded successfully.",
      });
      setComment("");
      setAdjustmentValue("");
      setAdjustmentReason("");
      await fetchNegotiations();
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ||
        err?.message ||
        "Failed to submit negotiation action.";
      setFeedbackMessage({
        type: "error",
        text: detail,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !block) return null;

  const depts = block.departments_involved || [];
  const resourceStatus = block.resource_status || "UNVERIFIED";
  const freightInfo = block.freight_impact || "Not available";
  const isIntegrated = block.is_integrated;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div
        className="relative z-10 w-full max-w-xl bg-card border-l border-border shadow-2xl h-full flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="block-detail-title"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border flex items-start justify-between bg-muted/30">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-extrabold text-foreground bg-background px-2.5 py-0.5 rounded border border-border">
                {block.optimized_block_id}
              </span>

              {isIntegrated ? (
                <span className="rounded bg-purple-50 dark:bg-purple-950 px-2 py-0.5 text-[11px] font-bold text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  Integrated Joint Block
                </span>
              ) : (
                <span className="rounded bg-blue-50 dark:bg-blue-950 px-2 py-0.5 text-[11px] font-bold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Single-Dept Block
                </span>
              )}

              <span className="inline-block rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {block.status || "Candidate"}
              </span>
            </div>

            <h2
              id="block-detail-title"
              className="text-base font-bold text-foreground pt-1"
            >
              Optimized Possession Recommendation
            </h2>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close block details"
            className="h-8 w-8 p-0 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* Key Attributes */}
          <div className="bg-muted/20 border border-border rounded p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                Railway Section
              </span>
              <span className="font-mono font-semibold text-foreground mt-0.5 block">
                {block.section_id}
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                Block Duration
              </span>
              <span className="font-mono font-semibold text-foreground mt-0.5 block">
                {formatDuration(block.block_duration_hrs)}
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                Realized Priority
              </span>
              <span className="font-mono font-extrabold text-blue-600 mt-0.5 block">
                {formatScore(block.realized_priority_value)}
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                Resource Status
              </span>
              <span
                className={`inline-block font-semibold mt-0.5 ${
                  resourceStatus === "VERIFIED"
                    ? "text-emerald-600"
                    : "text-amber-600"
                }`}
              >
                {resourceStatus}
              </span>
            </div>
          </div>

          {/* Time Interval Card */}
          <div className="p-3.5 rounded border border-border bg-card space-y-2">
            <span className="text-xs font-bold text-foreground block">
              Scheduled Corridor Window Interval
            </span>

            <div className="flex items-center justify-between text-xs font-mono bg-muted/40 p-2.5 rounded border border-border">
              <div>
                <span className="text-[10px] text-muted-foreground block uppercase">
                  Possession Start
                </span>
                <span className="font-bold text-foreground">
                  {formatDateTime(block.block_start)}
                </span>
              </div>

              <span className="text-muted-foreground">→</span>

              <div className="text-right">
                <span className="text-[10px] text-muted-foreground block uppercase">
                  Possession End
                </span>
                <span className="font-bold text-foreground">
                  {formatDateTime(block.block_end)}
                </span>
              </div>
            </div>
          </div>

          {/* Priority Value Distinction */}
          <div className="bg-muted/30 border border-border rounded p-3.5 space-y-2">
            <span className="text-xs font-bold text-foreground block">
              Priority Value Realization
            </span>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded bg-background border border-border space-y-1">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">
                  Realized Priority Value
                </span>

                <div className="text-xl font-mono font-extrabold text-blue-600">
                  {formatScore(block.realized_priority_value)}
                </div>

                <p className="text-[10px] text-muted-foreground">
                  Score achieved in the optimized global schedule for this task
                  set.
                </p>
              </div>

              <div className="p-2.5 rounded bg-background border border-border space-y-1">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">
                  Candidate Baseline Value
                </span>

                <div className="text-xl font-mono font-bold text-foreground">
                  {formatScore(
                    block.candidate_priority_value ??
                      block.realized_priority_value
                  )}
                </div>

                <p className="text-[10px] text-muted-foreground">
                  Unoptimized screening priority baseline from candidate
                  generation.
                </p>
              </div>
            </div>
          </div>

          {/* Departments Involved */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-foreground block">
              Departments Involved ({depts.length})
            </span>

            <div className="flex flex-wrap gap-2">
              {depts.map((d) => (
                <div
                  key={d}
                  className={`p-2.5 rounded border text-xs font-semibold flex items-center gap-2 ${
                    d === "Engineering"
                      ? "bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                      : d === "S&T"
                      ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                      : "bg-purple-50 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                  }`}
                >
                  <Wrench className="h-3.5 w-3.5" />
                  <span>{d}</span>
                  <SourceBadge department={d} />
                </div>
              ))}
            </div>
          </div>

          {/* Tasks Included */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground block">
                Work Orders Scheduled ({block.task_ids.length})
              </span>

              <span className="text-[11px] text-muted-foreground">
                Click work order to inspect in workbench
              </span>
            </div>

            <div className="space-y-1.5">
              {block.task_ids.map((taskId) => (
                <Link
                  key={taskId}
                  href="/maintenance"
                  className="p-2.5 rounded border border-border bg-background hover:bg-muted/40 transition-colors flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2">
                    <Wrench className="h-3.5 w-3.5 text-blue-600" />

                    <span className="font-mono text-xs font-bold text-foreground group-hover:text-primary">
                      {taskId}
                    </span>
                  </div>

                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
                </Link>
              ))}
            </div>
          </div>

          {/* Operational Constraints Summary */}
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="p-3 rounded border border-border bg-muted/20">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                Train Timetable Conflicts
              </span>

              <span className="text-base font-extrabold text-foreground mt-0.5 block">
                {block.train_conflicts} Conflicts
              </span>
            </div>

            <div className="p-3 rounded border border-border bg-muted/20">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                Freight Corridor Impact
              </span>

              <span className="text-base font-extrabold text-foreground mt-0.5 block">
                {freightInfo}
              </span>
            </div>
          </div>

          {/* Possession Readiness Gate */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-foreground block">
                  Possession Readiness Gate
                </span>

                <span className="text-[10px] text-muted-foreground">
                  Deterministic decision-support checks before human approval
                </span>
              </div>

              {readiness && (
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold border ${
                    readiness.readiness === "GO"
                      ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                      : readiness.readiness === "HOLD"
                      ? "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                      : "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800"
                  }`}
                >
                  {readiness.readiness}
                </span>
              )}
            </div>

            {isLoadingReadiness ? (
              <div className="rounded border border-border bg-muted/20 p-3 text-[11px] text-muted-foreground">
                Assessing possession readiness...
              </div>
            ) : readinessError ? (
              <div className="rounded border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/30 p-3 text-[11px] text-red-700 dark:text-red-300">
                Unable to assess readiness for this block. Please verify that
                the backend is available and the current user is authorized.
              </div>
            ) : readiness ? (
              <div
                className={`rounded border p-3.5 space-y-3 ${
                  readiness.readiness === "GO"
                    ? "border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/20"
                    : readiness.readiness === "HOLD"
                    ? "border-amber-200 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/20"
                    : "border-red-200 dark:border-red-900 bg-red-50/40 dark:bg-red-950/20"
                }`}
              >
                <div className="space-y-1">
                  <span className="text-xs font-bold text-foreground block">
                    {readiness.summary}
                  </span>

                  <span className="text-[10px] text-muted-foreground block">
                    AI/rule recommendation only — final possession decision
                    remains with the authorized human authority.
                  </span>
                </div>

                <div className="space-y-1.5">
                  {readiness.checks.map((check) => (
                    <div
                      key={check.key}
                      className="flex items-start gap-2 rounded bg-background/70 border border-border p-2"
                    >
                      {check.status === "PASS" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                      ) : check.status === "PENDING" ? (
                        <Clock className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5 text-red-600 mt-0.5 shrink-0" />
                      )}

                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-foreground block">
                          {check.label}
                        </span>

                        <span className="text-[10px] text-muted-foreground block">
                          {check.message}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded border border-amber-200 dark:border-amber-900 bg-amber-50/70 dark:bg-amber-950/30 px-2.5 py-2 text-[10px] text-amber-900 dark:text-amber-200 font-semibold flex items-center gap-2">
                  <ShieldIcon />
                  <span>Human decision required</span>
                </div>
              </div>
            ) : null}
          </div>

          {/* Multi-Department Negotiation (Badge 2) */}
          <div className="space-y-3 rounded-lg border border-border bg-card p-3.5 sm:p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-bold text-foreground">
                  Multi-Department Negotiation
                </span>
              </div>

              <span className="text-[10px] uppercase font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded">
                Human-in-the-loop
              </span>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Participating departments (Engineering, S&T, TRD) review recommended possession parameters, register approvals, or propose structured adjustments.
            </p>

            {/* Finalized Block Notice */}
            {((block.status || "").toUpperCase() === "APPROVED" ||
              (block.status || "").toUpperCase() === "REJECTED") ? (
              <div className="rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3 text-xs text-muted-foreground flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-slate-500 shrink-0" />
                <span>
                  This block is finalized ({block.status}). Further negotiation actions are closed.
                </span>
              </div>
            ) : isNegotiator ? (
              /* Negotiation Action Form */
              <form
                onSubmit={handleSubmitNegotiation}
                className="rounded border border-border bg-muted/20 p-3 space-y-3 text-xs"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-semibold text-foreground text-xs">
                    Submit Negotiation Action
                  </span>

                  {user?.roles.includes("ADMIN") ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-muted-foreground">Department:</span>
                      <select
                        value={selectedDept}
                        onChange={(e) => setSelectedDept(e.target.value)}
                        className="rounded border border-border bg-background px-2 py-1 text-xs font-semibold text-foreground"
                      >
                        <option value="ENGINEERING">Engineering</option>
                        <option value="SNT">S&T</option>
                        <option value="TRD">TRD</option>
                      </select>
                    </div>
                  ) : (
                    <span className="rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold px-2 py-0.5 text-[11px] border border-blue-200 dark:border-blue-800">
                      {selectedDept}
                    </span>
                  )}
                </div>

                {/* Action Selector */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAction("ACCEPT")}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded font-semibold text-xs border transition-all ${
                      action === "ACCEPT"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                        : "bg-background text-foreground border-border hover:bg-muted"
                    }`}
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                    <span>Accept</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAction("ADJUST")}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded font-semibold text-xs border transition-all ${
                      action === "ADJUST"
                        ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                        : "bg-background text-foreground border-border hover:bg-muted"
                    }`}
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span>Adjust</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAction("REJECT")}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded font-semibold text-xs border transition-all ${
                      action === "REJECT"
                        ? "bg-red-600 text-white border-red-600 shadow-xs"
                        : "bg-background text-foreground border-border hover:bg-muted"
                    }`}
                  >
                    <ThumbsDown className="h-3.5 w-3.5" />
                    <span>Reject</span>
                  </button>
                </div>

                {/* Structured Adjustment Details (Only when ADJUST is selected) */}
                {action === "ADJUST" && (
                  <div className="rounded border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-2.5 animate-in fade-in">
                    <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-semibold text-xs">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span>Structured Parameter Adjustment</span>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                        Adjustment Category
                      </label>
                      <select
                        value={adjustmentCategory}
                        onChange={(e) =>
                          setAdjustmentCategory(e.target.value as AdjustmentCategory)
                        }
                        className="w-full rounded border border-border bg-background p-1.5 text-xs text-foreground"
                      >
                        <option value="TIME_CHANGE">Time Window Change</option>
                        <option value="DURATION_CHANGE">Duration Modification</option>
                        <option value="RESOURCE_CONCERN">Depot / Machinery Resource</option>
                        <option value="TRAIN_CONFLICT">Train Schedule Conflict</option>
                        <option value="READINESS_CONCERN">Readiness / Pre-condition Concern</option>
                        <option value="OTHER">Other Operational Constraint</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                        Proposed Value / Adjustment Target <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={adjustmentValue}
                        onChange={(e) => setAdjustmentValue(e.target.value)}
                        placeholder="e.g., Shift start window to 03:00 UTC or +60 min"
                        className="w-full rounded border border-border bg-background p-1.5 text-xs text-foreground placeholder:text-muted-foreground"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                        Operational Rationale <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={adjustmentReason}
                        onChange={(e) => setAdjustmentReason(e.target.value)}
                        placeholder="e.g., OHE power isolation block required on adjacent siding"
                        className="w-full rounded border border-border bg-background p-1.5 text-xs text-foreground placeholder:text-muted-foreground"
                      />
                    </div>
                  </div>
                )}

                {/* Comment Field */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Notes / Remarks {action !== "ADJUST" ? "(Optional)" : ""}
                  </label>
                  <textarea
                    rows={2}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Enter departmental remarks or justification..."
                    className="w-full rounded border border-border bg-background p-2 text-xs text-foreground placeholder:text-muted-foreground resize-none"
                  />
                </div>

                {/* Feedback Notification */}
                {feedbackMessage && (
                  <div
                    className={`p-2.5 rounded text-xs flex items-center gap-2 ${
                      feedbackMessage.type === "success"
                        ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                        : "bg-red-50 dark:bg-red-950/50 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800"
                    }`}
                  >
                    {feedbackMessage.type === "success" ? (
                      <Check className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span>{feedbackMessage.text}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  size="sm"
                  className="w-full h-8 text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>
                    {isSubmitting
                      ? "Recording..."
                      : `Submit ${action} Action`}
                  </span>
                </Button>
              </form>
            ) : (
              <div className="rounded border border-border bg-muted/30 p-2.5 text-xs text-muted-foreground flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span>
                  Negotiation actions require an Engineering, S&T, or TRD departmental role.
                </span>
              </div>
            )}

            {/* Negotiation History Log */}
            <div className="space-y-2 pt-1 border-t border-border">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-bold text-foreground">
                  <History className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Negotiation History</span>
                </div>

                <span className="text-[10px] text-muted-foreground font-mono">
                  {negotiations.length} {negotiations.length === 1 ? "entry" : "entries"}
                </span>
              </div>

              {isLoadingNegotiations ? (
                <div className="p-3 text-[11px] text-muted-foreground text-center">
                  Loading negotiation records...
                </div>
              ) : negotiations.length > 0 ? (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {negotiations.map((log) => (
                    <div
                      key={log.id}
                      className="rounded border border-border bg-background p-2.5 space-y-1.5 text-xs shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-1 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold border ${
                              log.action === "ACCEPT"
                                ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                : log.action === "ADJUST"
                                ? "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                                : "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800"
                            }`}
                          >
                            {log.action}
                          </span>

                          <span className="font-bold text-foreground text-[11px]">
                            {log.department}
                          </span>
                        </div>

                        <span className="text-[10px] text-muted-foreground font-mono">
                          {formatDateTime(log.timestamp)}
                        </span>
                      </div>

                      {log.adjustment_payload && (
                        <div className="rounded bg-muted/40 p-2 border border-border text-[11px] space-y-0.5 font-mono">
                          {log.adjustment_category && (
                            <div className="text-[10px] text-muted-foreground uppercase font-bold">
                              Category: {log.adjustment_category}
                            </div>
                          )}
                          <div>
                            <span className="text-muted-foreground font-semibold">Value: </span>
                            <span className="text-foreground">{log.adjustment_payload.value}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground font-semibold">Reason: </span>
                            <span className="text-foreground">{log.adjustment_payload.reason}</span>
                          </div>
                        </div>
                      )}

                      {log.comment && (
                        <p className="text-[11px] text-muted-foreground italic pl-1 border-l-2 border-border">
                          &ldquo;{log.comment}&rdquo;
                        </p>
                      )}

                      <div className="text-[10px] text-muted-foreground text-right">
                        by <span className="font-semibold text-foreground">{log.performed_by}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground">
                  No department negotiations recorded yet.
                </div>
              )}
            </div>
          </div>

          {/* Possession Outcome Ledger (Badge 4) */}
          <PossessionOutcomePanel block={block} isAuthorized={isNegotiator} />

          {/* Mandatory Decision Support Notice */}
          <div className="p-3 rounded border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/30 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />

            <div>
              <span className="font-bold block">Decision Support Output</span>

              <span className="text-[11px]">
                This block is an algorithmic recommendation generated by
                Google OR-Tools CP-SAT. It represents a Candidate schedule and
                is NOT an officially approved railway possession until
                ratified by Divisional Operating Control.
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-muted/40 border-t border-border flex items-center justify-between text-xs text-muted-foreground gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Link
              href={`/map?run=${block.optimization_run_id}&section=${block.section_id}`}
              className="inline-flex items-center gap-1.5 bg-card border border-border hover:bg-muted text-foreground px-2.5 py-1.5 rounded text-xs font-semibold shadow-xs transition-colors"
            >
              <MapPin className="h-3.5 w-3.5 text-blue-600" />
              <span>View on Map</span>
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </Link>

            <Link
              href={`/optimization/runs/${block.optimization_run_id}/what-if?block=${block.id}`}
              className="inline-flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 px-2.5 py-1.5 rounded text-xs font-semibold shadow-xs transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
              <span>What-If Alternatives</span>
            </Link>

            <ExplainButton
              request={{
                explanation_type: "BLOCK_EXPLANATION",
                run_id: block.optimization_run_id,
                block_id: block.id,
              }}
              label="Explain Block"
              className="h-8"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-8 text-xs"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Small local icon wrapper so the readiness notice does not depend
 * on an additional icon import solely for this one label.
 */
function ShieldIcon() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-amber-400/60 text-[9px] font-bold"
    >
      H
    </span>
  );
}