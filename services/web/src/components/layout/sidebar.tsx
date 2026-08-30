"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Wrench,
  Calendar,
  Cpu,
  Activity,
  MapPin,
  CheckSquare,
  FileText,
  Train,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Maintenance", href: "/maintenance", icon: Wrench },
  { label: "Planning", href: "/planning", icon: Calendar },
  { label: "Optimization", href: "/optimization", icon: Cpu, badge: "CP-SAT" },
  { label: "Operations", href: "/operations", icon: Activity },
  { label: "Map", href: "/map", icon: MapPin },
  { label: "Approvals", href: "/approvals", icon: CheckSquare },
  { label: "Audit", href: "/audit", icon: FileText },
];

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export function Sidebar({ className, onNavigate }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-[var(--sidebar-background)] text-[var(--sidebar-foreground)] border-r border-[var(--sidebar-border)] w-64 select-none shrink-0",
        className
      )}
      aria-label="Main Navigation"
    >
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--sidebar-border)]">
        <div className="flex items-center justify-center h-8 w-8 rounded bg-blue-600 text-white shadow-xs">
          <Train className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
            <span>RailOpt AI</span>
            <span className="text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded bg-blue-950 text-blue-300 border border-blue-800/60">
              HWH
            </span>
          </h1>
          <p className="text-[11px] text-slate-400 font-mono">
            Howrah Division (ER)
          </p>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Operational Modules
        </div>
        <nav className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href || pathname?.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center justify-between px-3 py-2 rounded text-xs font-medium transition-colors outline-none focus-visible:ring-1 focus-visible:ring-blue-400",
                  isActive
                    ? "bg-blue-600 text-white font-semibold shadow-xs"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-white" : "text-slate-400")} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={cn(
                      "text-[9px] font-semibold px-1.5 py-0.5 rounded tracking-wide",
                      isActive
                        ? "bg-blue-800 text-blue-100"
                        : "bg-slate-800 text-slate-300 border border-slate-700"
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer / System Status */}
      <div className="p-3 border-t border-[var(--sidebar-border)] bg-slate-950/40">
        <div className="flex items-center justify-between px-2 py-1.5 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Optimization Engine</span>
          </span>
          <span className="font-mono text-[10px] text-slate-500">v0.1.0</span>
        </div>
      </div>
    </aside>
  );
}
