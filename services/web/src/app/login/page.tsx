"use client";

import React, { useEffect } from "react";
import { useAuth } from "react-oidc-context";
import { useRouter } from "next/navigation";
import {
  Shield,
  ArrowRight,
  Loader2,
  AlertCircle,
  Network,
  Cpu,
  Layers,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RailOptLogo } from "@/components/brand/railopt-logo";

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
    <div className="min-h-screen w-screen flex flex-col lg:flex-row bg-[#080D1A] text-slate-100 select-none overflow-x-hidden">
      {/* LEFT COLUMN: Railway Decision Support Platform Blueprint */}
      <div className="relative flex-1 flex flex-col justify-between p-8 lg:p-12 xl:p-16 bg-[#0B132B] border-b lg:border-b-0 lg:border-r border-slate-800/80 overflow-hidden">
        {/* Subtle Railway Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] [mask-image:radial-gradient(ellipse_70%_70%_at_50%_40%,#000_60%,transparent_100%)] opacity-20 pointer-events-none" />

        {/* Top: Brand & Division Pill */}
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <RailOptLogo size="lg" variant="full" />
            <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-950/80 text-blue-300 border border-blue-800/80 shadow-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
              <span>EASTERN RAILWAY • HWH</span>
            </div>
          </div>
        </div>

        {/* Middle: Core Mission Statement & Value Metrics */}
        <div className="relative z-10 my-10 lg:my-0 max-w-xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-blue-900/40 text-blue-300 text-xs font-semibold border border-blue-700/50">
            <Sparkles className="h-3.5 w-3.5 text-blue-400" />
            <span>Smart India Hackathon • Decision Support System</span>
          </div>

          <h1 className="text-3xl sm:text-4xl xl:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Intelligent Multi-Department Railway Possession Planning
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Consolidate civil track (<strong className="text-white">Engineering</strong>), signaling (<strong className="text-white">S&T</strong>), and overhead traction (<strong className="text-white">TRD</strong>) maintenance into synchronized corridor possessions using combinatorial optimization.
          </p>

          {/* Operational Capability Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-3.5 rounded-lg bg-slate-900/80 border border-slate-800 backdrop-blur-xs">
              <div className="flex items-center gap-2 text-blue-400 mb-1">
                <Network className="h-4 w-4" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Corridor Scope</span>
              </div>
              <p className="text-lg font-bold text-white">Howrah Division</p>
              <p className="text-[11px] text-slate-400 mt-0.5">9 Sections • 37 Stations</p>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-900/80 border border-slate-800 backdrop-blur-xs">
              <div className="flex items-center gap-2 text-emerald-400 mb-1">
                <Cpu className="h-4 w-4" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Optimization</span>
              </div>
              <p className="text-lg font-bold text-white">OR-Tools CP-SAT</p>
              <p className="text-[11px] text-slate-400 mt-0.5">&lt; 3.0s Global Solve</p>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-900/80 border border-slate-800 backdrop-blur-xs">
              <div className="flex items-center gap-2 text-amber-400 mb-1">
                <Layers className="h-4 w-4" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Consolidation</span>
              </div>
              <p className="text-lg font-bold text-white">3 Departments</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Zero Corridor Thrashing</p>
            </div>
          </div>
        </div>

        {/* Bottom Trust & Compliance Footer */}
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-4">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>Ministry of Railways Production Protocol</span>
          </span>
          <span className="font-mono text-[11px] text-slate-400">ER-HWH-OPT v1.0</span>
        </div>
      </div>

      {/* RIGHT COLUMN: Authentication Card */}
      <div className="w-full lg:w-[460px] xl:w-[500px] flex items-center justify-center p-6 sm:p-10 lg:p-12 bg-[#080D1A]">
        <div className="w-full max-w-sm space-y-6">
          {/* Card Box */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/90 shadow-2xl p-7 sm:p-8 backdrop-blur-sm space-y-6">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white">
                Sign In to Operations
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Authenticate via Keycloak OpenID Connect Single Sign-On.
              </p>
            </div>

            {/* Error Message if Present */}
            {auth.error && (
              <div className="p-3 rounded-lg border border-red-800 bg-red-950/60 text-red-200 text-xs flex items-start gap-2.5">
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

            {/* Single SSO Action Button */}
            <div className="space-y-4">
              <Button
                onClick={handleSignIn}
                disabled={auth.isLoading}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm gap-2.5 shadow-md hover:shadow-lg transition-all cursor-pointer rounded-lg"
              >
                {auth.isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Connecting to Keycloak...</span>
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4 text-blue-200" />
                    <span>Continue with Railway SSO</span>
                    <ArrowRight className="h-4 w-4 ml-auto" />
                  </>
                )}
              </Button>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 pt-1 text-center">
                <Shield className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                <span>Protected by 8-role Deny-by-Default RBAC.</span>
              </div>
            </div>

            {/* Demo Roles Matrix for Evaluators & Judges */}
            <div className="pt-4 border-t border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
                <span>Evaluator Demo Roles</span>
                <span className="text-[10px] text-blue-400 font-mono">Password: railopt_demo_2026</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[10px] text-slate-300">
                <div className="p-1.5 rounded bg-slate-950/60 border border-slate-800/80">
                  <span className="font-bold text-white block">planner.demo</span>
                  <span className="text-slate-400">Plan &amp; Solve</span>
                </div>
                <div className="p-1.5 rounded bg-slate-950/60 border border-slate-800/80">
                  <span className="font-bold text-white block">approver.demo</span>
                  <span className="text-slate-400">DRM Sign-off</span>
                </div>
                <div className="p-1.5 rounded bg-slate-950/60 border border-slate-800/80">
                  <span className="font-bold text-white block">control.demo</span>
                  <span className="text-slate-400">Section Control</span>
                </div>
                <div className="p-1.5 rounded bg-slate-950/60 border border-slate-800/80">
                  <span className="font-bold text-white block">viewer.demo</span>
                  <span className="text-slate-400">Read-Only</span>
                </div>
              </div>
            </div>
          </div>

          <p className="text-center text-[10px] text-slate-400 leading-tight">
            Authorized access only. All sessions, solver executions, and approval decisions are immutably logged in the divisional audit trail.
          </p>
        </div>
      </div>
    </div>
  );
}
