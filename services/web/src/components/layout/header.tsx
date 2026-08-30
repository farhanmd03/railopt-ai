"use client";

import React from "react";
import { User, Menu, Bell, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  onToggleMobileNav?: () => void;
}

export function Header({ onToggleMobileNav }: HeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 lg:px-6 select-none shrink-0">
      <div className="flex items-center gap-3">
        {onToggleMobileNav && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleMobileNav}
            className="lg:hidden text-muted-foreground"
            aria-label="Open mobile navigation"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span className="hidden sm:inline">Ministry of Railways</span>
          <span className="hidden sm:inline">•</span>
          <span className="font-semibold text-foreground">Eastern Railway</span>
          <span>•</span>
          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200">
            HOWRAH DIVISION
          </span>
        </div>
      </div>

      {/* Right side controls */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground h-8 w-8 relative"
          aria-label="Operational notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-blue-600" />
        </Button>

        <div className="h-4 w-px bg-border" />

        {/* User Identity / Role Indicator */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center justify-center h-7 w-7 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            <User className="h-3.5 w-3.5" />
          </div>
          <div className="hidden md:flex flex-col text-left">
            <span className="font-medium text-foreground text-xs leading-none">
              planner.demo
            </span>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
              <Shield className="h-2.5 w-2.5 text-blue-600" />
              <span>PLANNER</span>
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
