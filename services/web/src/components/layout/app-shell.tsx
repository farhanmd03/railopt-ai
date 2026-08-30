"use client";

import React, { useState } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--background)]">
      {/* Desktop Sidebar */}
      <Sidebar className="hidden lg:flex" />

      {/* Mobile Drawer Backdrop & Sidebar */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[var(--sidebar-background)] shadow-xl animate-in slide-in-from-left">
            <div className="absolute right-2 top-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileNavOpen(false)}
                className="text-slate-400 hover:text-white"
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Sidebar onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onToggleMobileNav={() => setMobileNavOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
