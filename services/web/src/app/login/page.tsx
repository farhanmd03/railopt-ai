"use client";

import React, { useEffect } from "react";
import { useAuth } from "react-oidc-context";
import { useRouter } from "next/navigation";
import { Train, Shield, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (auth.isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [auth.isAuthenticated, router]);

  const handleSignIn = async () => {
    try {
      await auth.signinRedirect();
    } catch (err) {
      console.error("Sign in initialization failed:", err);
    }
  };

  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-[#0f172a] text-slate-100 p-4 select-none">
      {/* Background Subtle Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-25 pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        {/* Main Login Card */}
        <div className="rounded border border-slate-800 bg-slate-900/90 shadow-2xl p-8 backdrop-blur-sm">
          {/* Header & Emblem */}
          <div className="flex flex-col items-center text-center space-y-3 mb-8">
            <div className="flex items-center justify-center h-12 w-12 rounded bg-blue-600 text-white shadow-lg ring-4 ring-blue-900/50">
              <Train className="h-7 w-7" />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-950 text-blue-300 border border-blue-800/80 mb-2 tracking-wider">
                <span>HOWRAH DIVISION</span>
                <span>•</span>
                <span>EASTERN RAILWAY</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                RailOpt AI
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Railway Maintenance Planning & Optimization Platform
              </p>
            </div>
          </div>

          {/* Authentication Error Alert */}
          {auth.error && (
            <div className="mb-6 p-3 rounded border border-red-800 bg-red-950/60 text-red-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
              <div>
                <span className="font-semibold block text-red-300">
                  Authentication Error
                </span>
                <span className="text-[11px] text-red-400">
                  {auth.error.message || "Failed to establish secure session with Keycloak."}
                </span>
              </div>
            </div>
          )}

          {/* Sign In Action Button */}
          <div className="space-y-4">
            <Button
              onClick={handleSignIn}
              disabled={auth.isLoading}
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium text-sm gap-2 shadow-md transition-all cursor-pointer"
            >
              {auth.isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Connecting to Keycloak...</span>
                </>
              ) : (
                <>
                  <span>Sign in with RailOpt</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>

            {/* Context / Trust Statement */}
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 pt-2 text-center">
              <Shield className="h-3.5 w-3.5 text-blue-400 shrink-0" />
              <span>Authorized access for railway maintenance planning users.</span>
            </div>
          </div>
        </div>

        {/* System Identifier Footer */}
        <div className="text-center text-[10px] text-slate-400 mt-6 space-y-1">
          <div>Ministry of Railways — Government of India</div>
          <div className="font-mono">SIH26027 Prototype Foundation • Local OIDC Realm: railopt</div>
        </div>
      </div>
    </div>
  );
}
