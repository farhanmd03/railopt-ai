"use client";

import React, { useState } from "react";
import { User as UserIcon, Menu, Bell, Shield, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "react-oidc-context";
import { buildAuthUser } from "@/lib/auth-config";

interface HeaderProps {
  onToggleMobileNav?: () => void;
}

export function Header({ onToggleMobileNav }: HeaderProps) {
  const auth = useAuth();
  const authUser = buildAuthUser(auth.user);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await auth.signoutRedirect({
        post_logout_redirect_uri: window.location.origin + "/login",
      });
    } catch {
      auth.removeUser();
      window.location.href = "/login";
    }
  };

  const primaryRole = authUser?.roles?.[0] || "VIEWER";

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 lg:px-6 select-none shrink-0 relative">
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

        {/* User Identity / Role Indicator with Logout Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 text-xs p-1 rounded hover:bg-muted transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
            aria-expanded={menuOpen}
            aria-haspopup="true"
          >
            <div className="flex items-center justify-center h-7 w-7 rounded-full bg-blue-100 text-blue-700 font-semibold border border-blue-200 text-xs">
              {authUser?.name?.charAt(0) || <UserIcon className="h-3.5 w-3.5" />}
            </div>
            <div className="hidden md:flex flex-col text-left">
              <span className="font-semibold text-foreground text-xs leading-none">
                {authUser?.name || "Authenticated User"}
              </span>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <Shield className="h-2.5 w-2.5 text-blue-600" />
                <span>{primaryRole}</span>
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
              <div className="absolute right-0 mt-2 w-56 rounded border border-border bg-card p-2 shadow-lg z-50 text-xs animate-in fade-in zoom-in-95">
                <div className="px-2 py-1.5 border-b border-border mb-1">
                  <p className="font-semibold text-foreground truncate">
                    {authUser?.name || "User"}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {authUser?.email || authUser?.username}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {authUser?.roles?.map((r) => (
                      <span
                        key={r}
                        className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-blue-50 text-blue-700 border border-blue-200"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors text-left"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign out of RailOpt</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
