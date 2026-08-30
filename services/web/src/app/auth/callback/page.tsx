"use client";

import React, { useEffect } from "react";
import { useAuth } from "react-oidc-context";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { sanitizeReturnUrl } from "@/lib/auth-config";

export default function AuthCallbackPage() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (auth.isAuthenticated) {
      const rawReturnUrl =
        typeof window !== "undefined"
          ? window.sessionStorage.getItem("railopt_auth_return_url")
          : null;
      const returnUrl = sanitizeReturnUrl(rawReturnUrl);
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("railopt_auth_return_url");
      }
      router.replace(returnUrl);
    }
  }, [auth.isAuthenticated, router]);

  if (auth.error) {
    return (
      <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-[#0f172a] text-slate-100 p-4">
        <div className="w-full max-w-md rounded border border-red-800 bg-slate-900/90 p-6 text-center space-y-4 shadow-xl">
          <div className="mx-auto flex items-center justify-center h-10 w-10 rounded-full bg-red-950 text-red-400 border border-red-800">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-red-200">
              Authentication Failed
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {auth.error.message || "Failed to complete token exchange with Keycloak."}
            </p>
          </div>
          <Link href="/login" className="inline-block w-full">
            <Button variant="outline" size="sm" className="w-full text-xs">
              Return to Sign In
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-[#0f172a] text-slate-100 p-4 space-y-3">
      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      <div className="text-center">
        <p className="text-sm font-semibold text-white">
          Authenticating with RailOpt AI...
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          Securing session with Keycloak OIDC provider.
        </p>
      </div>
    </div>
  );
}
