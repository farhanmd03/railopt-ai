"use client";

import React, { useState } from "react";
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
  LogOut,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "react-oidc-context";
import { extractRoles, isRouteAllowedForRoles } from "@/lib/auth-config";
import { RailOptLogo } from "@/components/brand/railopt-logo";
import { LogoutDialog } from "@/components/auth/logout-dialog";

export interface NavGroup {
  title: string;
  items: {
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "OVERVIEW",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "PLANNING",
    items: [
      { label: "Maintenance", href: "/maintenance", icon: Wrench },
      { label: "Planning", href: "/planning", icon: Calendar },
      { label: "Optimization", href: "/optimization", icon: Cpu, badge: "CP-SAT" },
      { label: "Calendar", href: "/planning/calendar", icon: SlidersHorizontal },
    ],
  },
  {
    title: "OPERATIONS",
    items: [
      { label: "Operations", href: "/operations", icon: Activity },
      { label: "Map GIS", href: "/map", icon: MapPin },
    ],
  },
  {
    title: "GOVERNANCE",
    items: [
      { label: "Approvals", href: "/approvals", icon: CheckSquare },
      { label: "Audit", href: "/audit", icon: FileText },
    ],
  },
];

export const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export function Sidebar({ className, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const auth = useAuth();
  const userRoles = extractRoles(auth?.user);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  const handleConfirmLogout = async () => {
    setShowLogoutDialog(false);
    try {
      await auth.signoutRedirect({
        post_logout_redirect_uri: window.location.origin + "/login",
      });
    } catch {
      auth.removeUser();
      window.location.href = "/login";
    }
  };

  return (
    <>
      <aside
        className={cn(
          "flex flex-col h-full bg-[#0B132B] text-slate-200 border-r border-slate-800/80 w-64 select-none shrink-0",
          className
        )}
        aria-label="Main Navigation"
      >
        {/* Brand Header */}
        <div className="flex items-center px-4 py-4 border-b border-slate-800/80 bg-slate-950/40">
          <RailOptLogo size="md" variant="full" />
        </div>

        {/* Grouped Navigation Links */}
        <div className="flex-1 px-3 py-3 space-y-4 overflow-y-auto custom-scrollbar">
          {NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter((item) =>
              isRouteAllowedForRoles(item.href, userRoles)
            );

            if (visibleItems.length === 0) return null;

            return (
              <div key={group.title} className="space-y-1">
                <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {group.title}
                </div>
                <nav className="space-y-0.5" aria-label={group.title}>
                  {visibleItems.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href !== "/dashboard" && pathname?.startsWith(`${item.href}`));
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onNavigate}
                        className={cn(
                          "flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-all outline-none focus-visible:ring-1 focus-visible:ring-blue-400",
                          isActive
                            ? "bg-blue-600 text-white font-semibold shadow-xs"
                            : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                        )}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon
                            className={cn(
                              "h-4 w-4 shrink-0",
                              isActive ? "text-white" : "text-slate-400"
                            )}
                          />
                          <span>{item.label}</span>
                        </div>
                        {item.badge && (
                          <span
                            className={cn(
                              "text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wide",
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
            );
          })}
        </div>

        {/* Footer / System Status & Logout */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/60 space-y-2">
          <div className="flex items-center justify-between px-2 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>OR-Tools CP-SAT</span>
            </span>
            <span className="text-[10px] font-mono text-slate-400 font-semibold px-1 py-0.5 rounded bg-slate-900 border border-slate-800">
              SOLVER READY
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowLogoutDialog(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium text-slate-400 hover:text-red-300 hover:bg-red-950/40 border border-transparent hover:border-red-900/60 transition-colors cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Logout Confirmation Modal */}
      <LogoutDialog
        isOpen={showLogoutDialog}
        onClose={() => setShowLogoutDialog(false)}
        onConfirm={handleConfirmLogout}
        userName={auth?.user?.profile?.preferred_username || auth?.user?.profile?.name}
      />
    </>
  );
}
