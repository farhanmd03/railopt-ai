import { apiGet, apiPost, apiClient } from "../api-client";
import type {
  PossessionOutcome,
  PossessionOutcomeCreateRequest,
  PossessionOutcomeUpdateRequest,
} from "../types/possession";

export function createPossessionOutcome(
  blockId: number,
  data: PossessionOutcomeCreateRequest,
): Promise<PossessionOutcome> {
  return apiPost<PossessionOutcome>(
    `/api/v1/optimization/blocks/${encodeURIComponent(String(blockId))}/possession-outcomes`,
    data,
  );
}

export function getBlockPossessionOutcomes(
  blockId: number,
): Promise<PossessionOutcome[]> {
  return apiGet<PossessionOutcome[]>(
    `/api/v1/optimization/blocks/${encodeURIComponent(String(blockId))}/possession-outcomes`,
  );
}

export function getPossessionOutcome(
  outcomeId: number,
): Promise<PossessionOutcome> {
  return apiGet<PossessionOutcome>(
    `/api/v1/possession-outcomes/${encodeURIComponent(String(outcomeId))}`,
  );
}

export function updatePossessionOutcome(
  outcomeId: number,
  data: PossessionOutcomeUpdateRequest,
): Promise<PossessionOutcome> {
  return apiClient<PossessionOutcome>(
    `/api/v1/possession-outcomes/${encodeURIComponent(String(outcomeId))}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    },
  );
}
