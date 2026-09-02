"use client";

import React, { useState } from "react";
import { User as UserIcon, Menu, Bell, Shield, LogOut, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "react-oidc-context";
import { buildAuthUser, isDemoSession } from "@/lib/auth-config";
import { LogoutDialog } from "@/components/auth/logout-dialog";
import { RailOptLogo } from "@/components/brand/railopt-logo";

interface HeaderProps {
  onToggleMobileNav?: () => void;
}

export function Header({ onToggleMobileNav }: HeaderProps) {
  const auth = useAuth();
  const authUser = buildAuthUser(auth.user);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  const handleConfirmLogout = async () => {
    setShowLogoutDialog(false);
    if (isDemoSession(auth.user)) {
      await auth.removeUser();
      window.location.href = "/login";
      return;
    }
    try {
      await auth.signoutRedirect({
        post_logout_redirect_uri: window.location.origin + "/login",
      });
    } catch {
      await auth.removeUser();
      window.location.href = "/login";
    }
  };

  const hasRoles = !!authUser && authUser.roles.length > 0;
  const primaryRole = hasRoles ? authUser.roles[0] : "No application role";

  return (
    <>
      <header className="flex h-14 items-center justify-between border-b border-border bg-card/95 backdrop-blur-xs px-4 lg:px-6 select-none shrink-0 relative z-30">
        {/* Left side: Mobile Toggle & Division Context */}
        <div className="flex items-center gap-3">
          {onToggleMobileNav && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleMobileNav}
              className="lg:hidden text-muted-foreground hover:text-foreground h-8 w-8"
              aria-label="Open mobile navigation"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}

          <div className="lg:hidden">
            <RailOptLogo size="sm" variant="compact" />
          </div>

          <div className="hidden lg:flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span className="text-slate-500 font-medium">Ministry of Railways</span>
            <span className="text-slate-300">•</span>
            <span className="font-semibold text-foreground">Eastern Railway</span>
            <span className="text-slate-300">•</span>
            <span className="rounded bg-blue-50 dark:bg-blue-950 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80 tracking-wide">
              HOWRAH DIVISION
            </span>
          </div>
        </div>

        {/* Right side controls: Live Status, Notifications, User Profile */}
        <div className="flex items-center gap-3">
          {/* Operational Status Indicator */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 text-[11px] font-medium shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>System Operational</span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground h-8 w-8 relative rounded-md"
            aria-label="Operational notifications"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-blue-600 ring-2 ring-card" />
          </Button>

          <div className="h-4 w-px bg-border" />

          {/* User Identity / Role Indicator with Logout Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 text-xs p-1 rounded-md hover:bg-muted/80 transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
              aria-expanded={menuOpen}
              aria-haspopup="true"
            >
              <div className="flex items-center justify-center h-7 w-7 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-bold text-xs shadow-xs ring-1 ring-blue-700/30">
                {authUser?.name?.charAt(0) || <UserIcon className="h-3.5 w-3.5" />}
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="font-semibold text-foreground text-xs leading-none">
                  {authUser?.name || "Authenticated User"}
                </span>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Shield className={`h-2.5 w-2.5 ${hasRoles ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"}`} />
                  <span className={hasRoles ? "font-semibold text-foreground" : "text-muted-foreground italic"}>
                    {primaryRole}
                  </span>
                </span>
              </div>
            </button>

            {/* User dropdown menu */}
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-60 rounded-md border border-border bg-card p-2 shadow-lg z-50 text-xs animate-in fade-in zoom-in-95">
                  <div className="px-2 py-2 border-b border-border mb-1.5">
                    <p className="font-bold text-foreground truncate">
                      {authUser?.name || "User"}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {authUser?.email || authUser?.username}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {hasRoles ? (
                        authUser?.roles?.map((r) => (
                          <span
                            key={r}
                            className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                          >
                            {r}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic">
                          No roles assigned
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setShowLogoutDialog(true);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 hover:text-red-700 dark:hover:text-red-400 transition-colors text-left font-medium cursor-pointer"
                  >
                    <LogOut className="h-3.5 w-3.5 shrink-0" />
                    <span>Sign out of RailOpt AI...</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Accessible Logout Confirmation Dialog */}
      <LogoutDialog
        isOpen={showLogoutDialog}
        onClose={() => setShowLogoutDialog(false)}
        onConfirm={handleConfirmLogout}
        userName={authUser?.name}
      />
    </>
  );
}
