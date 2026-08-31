/**
 * What-If Scenario Analysis API Client Functions (Batch 7K).
 */

import { apiGet, apiPost } from "../api-client";
import {
  OptimizationScenario,
  ScenarioCreatePayload,
  ScenarioListResponse,
} from "../types/scenario";

export function getRunScenarios(runId: string | number): Promise<ScenarioListResponse> {
  return apiGet<ScenarioListResponse>(
    `/api/v1/optimization/runs/${encodeURIComponent(String(runId))}/scenarios`
  );
}

export function createRunScenario(
  runId: string | number,
  payload: ScenarioCreatePayload
): Promise<OptimizationScenario> {
  return apiPost<OptimizationScenario>(
    `/api/v1/optimization/runs/${encodeURIComponent(String(runId))}/scenarios`,
    payload
  );
}

export function getScenarioDetail(scenarioId: string | number): Promise<OptimizationScenario> {
  return apiGet<OptimizationScenario>(
    `/api/v1/optimization/scenarios/${encodeURIComponent(String(scenarioId))}`
  );
}
