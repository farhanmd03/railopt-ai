"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "react-oidc-context";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/feedback/loading-state";
import { ForbiddenState } from "@/components/feedback/forbidden-state";
import {
  extractRoles,
  isRouteAllowedForRoles,
  ROLE_ROUTE_PERMISSIONS,
} from "@/lib/auth-config";

interface AppShellProps {
  children: React.ReactNode;
}

const PUBLIC_ROUTES = ["/login", "/auth/callback"];

export function AppShell({ children }: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();

  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname?.startsWith(`${route}/`)
  );

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated && !isPublicRoute) {
      if (typeof window !== "undefined" && pathname && pathname !== "/") {
        window.sessionStorage.setItem("railopt_auth_return_url", pathname);
      }
      router.replace("/login");
    }
  }, [auth.isLoading, auth.isAuthenticated, isPublicRoute, pathname, router]);

  // If on a public route (login / auth callback), render without sidebar/header shell
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // If auth is loading, show operational verification state
  if (auth.isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[var(--background)] p-4">
        <LoadingState
          message="Verifying OIDC identity & permissions..."
          className="max-w-md w-full shadow-sm"
        />
      </div>
    );
  }

  // If unauthenticated (and not on public route), show redirect placeholder
  if (!auth.isAuthenticated) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[var(--background)] p-4">
        <LoadingState
          message="Redirecting to RailOpt authentication..."
          className="max-w-md w-full shadow-sm"
        />
      </div>
    );
  }

  // Check role-based UI route access
  const userRoles = extractRoles(auth.user);
  const isAllowed = isRouteAllowedForRoles(pathname, userRoles);

  const matchedRoute = Object.keys(ROLE_ROUTE_PERMISSIONS).find(
    (route) => pathname === route || pathname?.startsWith(`${route}/`)
  );
  const requiredRoles = matchedRoute ? ROLE_ROUTE_PERMISSIONS[matchedRoute] : [];

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
          <div className="mx-auto max-w-7xl">
            {isAllowed ? (
              children
            ) : (
              <ForbiddenState
                userRoles={userRoles}
                requiredRoles={requiredRoles}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
