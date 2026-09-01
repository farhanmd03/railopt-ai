"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ExplanationRequest, ExplanationResponse } from "@/lib/types/explanation";
import { generateExplanation } from "@/lib/api/explanations";
import { ExplanationDrawer } from "./explanation-drawer";
import { Sparkles, Loader2 } from "lucide-react";

interface ExplainButtonProps {
  request: ExplanationRequest;
  label?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function ExplainButton({
  request,
  label = "Explain with AI",
  variant = "outline",
  size = "sm",
  className = "",
}: ExplainButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [explanation, setExplanation] = useState<ExplanationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchExplanation = async () => {
    setIsLoading(true);
    setError(null);
    setIsOpen(true);
    try {
      const result = await generateExplanation(request);
      setExplanation(result);
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        "Local explanation service unavailable. Please check that Ollama is running.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={fetchExplanation}
        disabled={isLoading}
        className={`gap-1.5 text-xs border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 shadow-2xs ${className}`}
        title="Generate AI-powered natural-language explanation"
      >
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
        ) : (
          <Sparkles className="h-3.5 w-3.5 text-blue-600 fill-blue-100 dark:fill-blue-900" />
        )}
        <span>{label}</span>
      </Button>

      <ExplanationDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        request={request}
        explanation={explanation}
        isLoading={isLoading}
        error={error}
        onRetry={fetchExplanation}
      />
    </>
  );
}
