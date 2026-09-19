"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "react-oidc-context";
import { buildAuthUser } from "@/lib/auth-config";
import { DepartmentMessage } from "@/lib/types/optimization";
import * as optimizationApi from "@/lib/api/optimization";
import { formatDateTime } from "@/lib/utils";
import { MessageSquare, SendHorizonal, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DepartmentCommunicationChannelProps {
  blockId: number;
  departments?: string[];
  compact?: boolean;
  className?: string;
  onMessageSent?: (msg: DepartmentMessage) => void;
}

export function DepartmentCommunicationChannel({
  blockId,
  departments,
  compact = false,
  className = "",
  onMessageSent,
}: DepartmentCommunicationChannelProps) {
  const auth = useAuth();
  const user = React.useMemo(() => buildAuthUser(auth.user), [auth.user]);

  const isNegotiator = React.useMemo(() => {
    if (!user) return false;
    return user.roles.some((r) =>
      ["ENGINEERING", "SNT", "TRD", "ADMIN", "PLANNER", "CONTROL", "APPROVER"].includes(r)
    );
  }, [user]);

  const defaultDept = React.useMemo(() => {
    if (!user) return "ENGINEERING";
    if (user.roles.includes("ENGINEERING")) return "ENGINEERING";
    if (user.roles.includes("SNT")) return "SNT";
    if (user.roles.includes("TRD")) return "TRD";
    return "ENGINEERING";
  }, [user]);

  const [messages, setMessages] = useState<DepartmentMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [chatDept, setChatDept] = useState<string>("ENGINEERING");

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const isFetchingRef = useRef<boolean>(false);

  useEffect(() => {
    if (defaultDept) {
      setChatDept(defaultDept);
    }
  }, [defaultDept]);

  // Fetch messages function
  const fetchMessages = useCallback(async (isInitial = false) => {
    if (!blockId || isFetchingRef.current) return;
    try {
      isFetchingRef.current = true;
      if (isInitial) setIsLoadingMessages(true);
      const data = await optimizationApi.getBlockMessages(blockId);
      if (isMountedRef.current) {
        setMessages(data || []);
      }
    } catch {
      // Graceful silence during background polling
    } finally {
      isFetchingRef.current = false;
      if (isMountedRef.current && isInitial) {
        setIsLoadingMessages(false);
      }
    }
  }, [blockId]);

  // Initial load and polling setup
  useEffect(() => {
    isMountedRef.current = true;
    fetchMessages(true);

    const intervalId = setInterval(() => {
      fetchMessages(false);
    }, 4000);

    return () => {
      isMountedRef.current = false;
      clearInterval(intervalId);
    };
  }, [blockId, fetchMessages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockId || !chatMessage.trim() || isSendingMessage) return;

    try {
      setIsSendingMessage(true);
      const dept = user?.roles.includes("ADMIN") ? chatDept : defaultDept;
      const newMsg = await optimizationApi.sendBlockMessage(blockId, {
        department: dept,
        message: chatMessage.trim(),
      });

      if (isMountedRef.current) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        setChatMessage("");
      }
      if (onMessageSent) {
        onMessageSent(newMsg);
      }
    } catch {
      // Handled
    } finally {
      if (isMountedRef.current) {
        setIsSendingMessage(false);
      }
    }
  };

  return (
    <div className={`space-y-3 rounded-lg border border-border bg-card p-3.5 sm:p-4 shadow-2xs ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-blue-600 shrink-0" />
          <span className="text-xs font-bold text-foreground">
            Inter-Department Communication Channel
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Discussion
          </span>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Shared operational discussion between Engineering, S&T and TRD.
      </p>

      {/* Message Stream */}
      <div
        className={`space-y-2 overflow-y-auto pr-1 bg-muted/20 p-2.5 rounded border border-border/60 ${
          compact ? "max-h-52" : "max-h-80 min-h-[160px]"
        }`}
      >
        {isLoadingMessages ? (
          <div className="p-6 text-[11px] text-muted-foreground text-center flex flex-col items-center justify-center gap-1.5">
            <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
            <span>Loading discussion messages...</span>
          </div>
        ) : messages.length > 0 ? (
          messages.map((m) => (
            <div
              key={m.id}
              className="p-2.5 rounded bg-background border border-border text-xs space-y-1 shadow-2xs"
            >
              <div className="flex items-center justify-between gap-1 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                      m.department.toUpperCase() === "ENGINEERING"
                        ? "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300"
                        : m.department.toUpperCase() === "SNT" || m.department.toUpperCase() === "S&T"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300"
                        : "bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300"
                    }`}
                  >
                    {m.department}
                  </span>
                  <span className="text-[11px] font-semibold text-foreground">
                    {m.actor}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {formatDateTime(m.timestamp)}
                </span>
              </div>
              <p className="text-[11px] text-foreground pl-0.5">{m.message}</p>
            </div>
          ))
        ) : (
          <div className="p-6 text-center text-[11px] text-muted-foreground">
            No department messages yet. Start a discussion below.
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Chips */}
      <div className="flex items-center gap-1.5 flex-wrap pt-1">
        <span className="text-[10px] text-muted-foreground font-semibold">Quick Chips:</span>
        {[
          "Track access requires +30m preparation",
          "Signalling circuits ready for window",
          "OHE power isolation confirmed on siding",
          "Accepting recommended schedule",
        ].map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => setChatMessage(chip)}
            className="text-[10px] px-2 py-0.5 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/80 transition-colors cursor-pointer"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Message Composer */}
      {isNegotiator ? (
        <form onSubmit={handleSendMessage} className="space-y-2 pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            {user?.roles.includes("ADMIN") ? (
              <select
                value={chatDept}
                onChange={(e) => setChatDept(e.target.value)}
                className="rounded border border-border bg-background px-2 py-1 text-xs font-semibold text-foreground shrink-0"
              >
                <option value="ENGINEERING">Engineering</option>
                <option value="SNT">S&T</option>
                <option value="TRD">TRD</option>
              </select>
            ) : (
              <span className="rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold px-2 py-1 text-[11px] border border-blue-200 dark:border-blue-800 shrink-0">
                {defaultDept}
              </span>
            )}
            <input
              type="text"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              placeholder="Type operational discussion message..."
              className="flex-1 rounded border border-border bg-background px-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground"
            />
            <Button
              type="submit"
              size="sm"
              disabled={isSendingMessage || !chatMessage.trim()}
              className="h-7 text-xs px-2.5 gap-1 shrink-0 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <SendHorizonal className="h-3 w-3" />
              <span>Send</span>
            </Button>
          </div>
        </form>
      ) : (
        <div className="text-[11px] text-muted-foreground italic">
          Sign in with an Engineering, S&T, or TRD role to participate in the discussion.
        </div>
      )}
    </div>
  );
}
