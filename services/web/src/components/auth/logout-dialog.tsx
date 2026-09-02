"use client";

import React, { useEffect } from "react";
import { LogOut, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LogoutDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  userName?: string;
}

export function LogoutDialog({
  isOpen,
  onClose,
  onConfirm,
  userName,
}: LogoutDialogProps) {
  // Handle Escape key to close dialog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-dialog-title"
      aria-describedby="logout-dialog-description"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div className="relative z-10 w-full max-w-md rounded-lg border border-slate-200 dark:border-slate-800 bg-card p-6 shadow-xl animate-in zoom-in-95 duration-150">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground rounded p-1 transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
          aria-label="Close dialog"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Icon & Heading */}
        <div className="flex items-start gap-3.5">
          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 shrink-0 border border-red-200 dark:border-red-900">
            <LogOut className="h-5 w-5" />
          </div>
          <div>
            <h2
              id="logout-dialog-title"
              className="text-base font-bold tracking-tight text-foreground"
            >
              Sign out of RailOpt AI?
            </h2>
            <p
              id="logout-dialog-description"
              className="text-xs text-muted-foreground mt-1.5 leading-relaxed"
            >
              {userName ? `User "${userName}", your` : "Your"} active operational session will be ended. You will need to sign in again via OpenID Connect to access Howrah Division planning workspaces.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs h-9 px-4 font-medium"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onConfirm}
            className="text-xs h-9 px-4 font-semibold bg-red-600 hover:bg-red-700 active:bg-red-800 text-white gap-1.5 shadow-xs"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign out</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
