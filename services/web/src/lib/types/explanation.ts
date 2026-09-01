/**
 * TypeScript types for Explainability Layer with Multi-Provider Support (Ollama / Gemini / Deterministic).
 */

export type ExplanationType =
  | "RUN_SUMMARY"
  | "BLOCK_EXPLANATION"
  | "UNASSIGNED_TASK"
  | "SCENARIO_COMPARISON";

export interface ExplanationRequest {
  explanation_type: ExplanationType;
  run_id: number;
  block_id?: number | null;
  task_id?: string | null;
  scenario_id?: string | null;
}

export interface ExplanationHealthResponse {
  available: boolean;
  base_url: string;
  model: string;
  message: string;
  active_provider?: string;
  ollama_available?: boolean;
  gemini_configured?: boolean;
}

export interface ExplanationResponse {
  explanation_type: ExplanationType;
  summary: string;
  key_factors: string[];
  limitations: string[];
  confidence_note: string;
  deterministic_facts: Record<string, unknown>;
  model_name: string;
  provider?: string;
  disclaimer: string;
  generated_at: string;
}
