import React from "react";
import { cn } from "@/lib/utils";

interface RailOptLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "full" | "compact" | "icon";
  className?: string;
  theme?: "light" | "dark" | "auto";
}

export function RailOptLogo({
  size = "md",
  variant = "full",
  className,
  theme = "auto",
}: RailOptLogoProps) {
  const iconDimensions = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-10 w-10",
    xl: "h-14 w-14",
  }[size];

  const titleSizes = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
    xl: "text-xl",
  }[size];

  return (
    <div className={cn("flex items-center gap-2.5 select-none", className)}>
      {/* Geometric Railway Optimization Mark (SVG) */}
      <div
        className={cn(
          "relative flex items-center justify-center rounded-md bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 text-white shadow-sm ring-1 ring-white/20 shrink-0",
          iconDimensions
        )}
      >
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-4/5 w-4/5"
        >
          {/* Dual Parallel Railway Rails */}
          <path
            d="M7 4L7 28"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            className="opacity-75"
          />
          <path
            d="M25 4L25 28"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            className="opacity-75"
          />

          {/* Railway Sleepers / Ties */}
          <line
            x1="7"
            y1="8"
            x2="25"
            y2="8"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            className="opacity-50"
          />
          <line
            x1="7"
            y1="16"
            x2="25"
            y2="16"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            className="opacity-50"
          />
          <line
            x1="7"
            y1="24"
            x2="25"
            y2="24"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            className="opacity-50"
          />

          {/* Interlocking Optimization Pathway (Stylized 'R' + Optimal Curve) */}
          <path
            d="M10 24V9C10 9 13 6 18 6C22.5 6 22.5 12 18 12H10M16 12L22 24"
            stroke="#93C5FD"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Convergence Node / Optimal Coordinate Dot */}
          <circle cx="18" cy="12" r="2" fill="#60A5FA" />
          <circle cx="22" cy="24" r="1.6" fill="#38BDF8" />
        </svg>
      </div>

      {/* Typography: Wordmark & Divisional Context */}
      {variant !== "icon" && (
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-1.5 leading-none">
            <span
              className={cn(
                "font-bold tracking-tight text-foreground font-sans",
                titleSizes
              )}
            >
              RailOpt
            </span>
            <span
              className={cn(
                "font-extrabold tracking-tight text-blue-600 dark:text-blue-400 font-sans",
                titleSizes
              )}
            >
              AI
            </span>
            <span className="text-[9px] uppercase font-bold px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800/80 leading-none">
              HWH
            </span>
          </div>
          {variant === "full" && (
            <span className="text-[10px] text-muted-foreground font-medium tracking-tight mt-0.5">
              Eastern Railway • Howrah
            </span>
          )}
        </div>
      )}
    </div>
  );
}
