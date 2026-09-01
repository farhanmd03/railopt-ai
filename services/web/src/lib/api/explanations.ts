import { apiGet, apiPost } from "../api-client";
import {
  ExplanationHealthResponse,
  ExplanationRequest,
  ExplanationResponse,
} from "../types/explanation";

/**
 * Check local Ollama explanation engine health and availability.
 */
export function getExplanationHealth(): Promise<ExplanationHealthResponse> {
  return apiGet<ExplanationHealthResponse>("/api/v1/explanations/health");
}

/**
 * Generate structured, fact-grounded explanation from backend service.
 */
export function generateExplanation(
  request: ExplanationRequest
): Promise<ExplanationResponse> {
  return apiPost<ExplanationResponse>("/api/v1/explanations", request);
}
