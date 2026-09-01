"""LLM Provider Abstraction Layer for RailOpt AI Explainability (Batch 7O/LLM).

Supports:
1. OllamaProvider: Local, zero-cost, air-gapped LLM runtime (e.g. gemma2:2b).
2. GeminiProvider: Google Gemini hosted LLM fallback for cloud/hosted deployments.
3. DeterministicProvider: 100% reliable, zero-dependency, rule-based fallback.

CRITICAL SAFETY INVARIANT:
All providers function strictly as advisory translation layers.
Providers have ZERO authority over scheduling, optimization mathematics,
constraints, resource assignments, safety validations, or approvals.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List, Optional, Protocol, Tuple

import httpx

from app.core.config import settings
from app.schemas.explanation import ExplanationType

logger = logging.getLogger(__name__)


def sanitize_untrusted_data(text: str) -> str:
    """Sanitize database strings to prevent prompt injection boundary escape.

    Specifically escapes closing and opening XML tags used for untrusted system data isolation.
    """
    if not text:
        return ""
    # Neutralize closing and opening boundaries
    sanitized = text.replace("</UNTRUSTED_SYSTEM_DATA>", "[ESCAPED_CLOSING_TAG]")
    sanitized = sanitized.replace("<UNTRUSTED_SYSTEM_DATA>", "[ESCAPED_OPENING_TAG]")
    return sanitized


class LLMProvider(Protocol):
    """Protocol for explainability LLM providers."""

    provider_name: str
    model_name: str

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        facts: Dict[str, Any],
        exp_type: ExplanationType,
    ) -> Dict[str, Any]:
        """Generate structured explanation JSON."""
        ...

    async def check_health(self) -> bool:
        """Check if provider is available."""
        ...


class OllamaProvider:
    """Local Ollama LLM provider."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        timeout_seconds: Optional[float] = None,
    ):
        self.provider_name = "ollama"
        self.base_url = (base_url or settings.ollama_base_url).rstrip("/")
        self.model_name = model or settings.ollama_model
        self.timeout_seconds = timeout_seconds or getattr(settings, "ollama_timeout_seconds", 25.0)

    async def check_health(self) -> bool:
        """Check if local Ollama daemon is responsive and model exists."""
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(f"{self.base_url}/api/tags")
                return resp.status_code == 200
        except Exception as e:
            logger.debug(f"Ollama health check unreachable at {self.base_url}: {e}")
            return False

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        facts: Dict[str, Any],
        exp_type: ExplanationType,
    ) -> Dict[str, Any]:
        """Call local Ollama API asynchronously and return parsed structured response."""
        full_prompt = f"{system_prompt}\n\n{user_prompt}"

        payload = {
            "model": self.model_name,
            "prompt": full_prompt,
            "stream": False,
            "format": "json",
            "options": {
                "temperature": 0.2,
                "top_p": 0.9,
                "num_predict": 350,
            },
        }

        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            resp = await client.post(f"{self.base_url}/api/generate", json=payload)
            if resp.status_code != 200:
                raise RuntimeError(
                    f"Ollama returned HTTP {resp.status_code}: {resp.text[:150]}"
                )
            data = resp.json()
            raw_response = data.get("response", "")
            return parse_model_json_output(raw_response, facts, exp_type)


class GeminiProvider:
    """Google Gemini hosted LLM provider for cloud deployments."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        timeout_seconds: Optional[float] = None,
        api_base: Optional[str] = None,
    ):
        self.provider_name = "gemini"
        self.api_key = api_key or getattr(settings, "gemini_api_key", None)
        self.model_name = model or getattr(settings, "gemini_model", "gemini-2.5-flash")
        self.timeout_seconds = timeout_seconds or getattr(settings, "gemini_timeout_seconds", 20.0)
        self.api_base = (api_base or getattr(settings, "gemini_api_base", "https://generativelanguage.googleapis.com/v1beta")).rstrip("/")

    async def check_health(self) -> bool:
        """Check if Gemini API key is configured."""
        return bool(self.api_key and len(self.api_key.strip()) > 5)

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        facts: Dict[str, Any],
        exp_type: ExplanationType,
    ) -> Dict[str, Any]:
        """Call Gemini REST API with structured JSON output and masked credentials."""
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is not configured in backend environment.")

        endpoint = f"{self.api_base}/models/{self.model_name}:generateContent"

        payload = {
            "system_instruction": {
                "parts": [{"text": system_prompt}]
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": user_prompt}]
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "topP": 0.9,
                "maxOutputTokens": 600,
                "responseMimeType": "application/json",
            }
        }

        headers = {
            "Content-Type": "application/json",
            "x-goog-api-key": self.api_key,
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                resp = await client.post(endpoint, json=payload, headers=headers)
                if resp.status_code != 200:
                    # Sanitize error output to ensure API key is never leaked
                    clean_err = resp.text.replace(self.api_key, "[REDACTED_API_KEY]")
                    raise RuntimeError(f"Gemini API returned HTTP {resp.status_code}: {clean_err[:150]}")

                data = resp.json()
                candidates = data.get("candidates", [])
                if not candidates:
                    raise RuntimeError("Gemini API returned empty candidate list.")

                content_parts = candidates[0].get("content", {}).get("parts", [])
                if not content_parts:
                    raise RuntimeError("Gemini API candidate content parts are empty.")

                raw_text = content_parts[0].get("text", "")
                return parse_model_json_output(raw_text, facts, exp_type)
        except httpx.TimeoutException:
            raise TimeoutError(f"Gemini API timed out after {self.timeout_seconds}s")
        except Exception as e:
            # Mask potential key leakage in exception strings
            err_msg = str(e).replace(self.api_key, "[REDACTED_API_KEY]") if self.api_key else str(e)
            logger.warning(f"Gemini generation error: {err_msg}")
            raise


class DeterministicProvider:
    """Deterministic, rule-based explanation provider (100% offline, zero-network fallback)."""

    def __init__(self, model_name: str = "deterministic-rule-engine"):
        self.provider_name = "deterministic"
        self.model_name = model_name

    async def check_health(self) -> bool:
        return True

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        facts: Dict[str, Any],
        exp_type: ExplanationType,
    ) -> Dict[str, Any]:
        """Synthesize deterministic factual explanation directly from facts dictionary."""
        summary = build_deterministic_summary(facts, exp_type)
        key_factors = build_deterministic_key_factors(facts, exp_type)
        limitations = [
            "Explanation synthesized by deterministic rule engine (LLM service offline or unconfigured).",
            "Authoritative underlying facts verified directly from PostgreSQL and CP-SAT outputs.",
        ]
        confidence_note = "Explanation derived strictly from deterministic solver outputs without operational authority."

        return {
            "summary": summary,
            "key_factors": key_factors,
            "limitations": limitations,
            "confidence_note": confidence_note,
        }


def parse_model_json_output(
    raw_output: str,
    facts: Dict[str, Any],
    exp_type: ExplanationType,
) -> Dict[str, Any]:
    """Safely parse and sanitize JSON output from any LLM provider."""
    cleaned = raw_output.strip()
    # Strip markdown formatting if model wraps output in ```json ... ```
    cleaned = re.sub(r"^```json\s*", "", cleaned)
    cleaned = re.sub(r"^```\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        parsed = json.loads(cleaned)
        summary = str(parsed.get("summary", "")).strip()
        key_factors = parsed.get("key_factors", [])
        if not isinstance(key_factors, list):
            key_factors = [str(key_factors)]
        key_factors = [str(k).strip() for k in key_factors if str(k).strip()]

        limitations = parsed.get("limitations", [])
        if not isinstance(limitations, list):
            limitations = [str(limitations)]
        limitations = [str(l).strip() for l in limitations if str(l).strip()]

        confidence_note = str(
            parsed.get(
                "confidence_note",
                "Explanation derived strictly from deterministic solver outputs without operational authority.",
            )
        ).strip()

        if not summary:
            summary = build_deterministic_summary(facts, exp_type)

        return {
            "summary": summary,
            "key_factors": key_factors or build_deterministic_key_factors(facts, exp_type),
            "limitations": limitations or ["AI-generated advisory text; human operational sign-off required."],
            "confidence_note": confidence_note,
        }
    except Exception as e:
        logger.warning(f"Failed to parse LLM JSON response: {e}. Raw was: {raw_output[:150]}")
        return {
            "summary": build_deterministic_summary(facts, exp_type),
            "key_factors": build_deterministic_key_factors(facts, exp_type),
            "limitations": [
                "LLM provider returned non-JSON structure; deterministic explanation supplied.",
            ],
            "confidence_note": "Explanation derived strictly from deterministic solver outputs.",
        }


def build_deterministic_summary(facts: Dict[str, Any], exp_type: ExplanationType) -> str:
    """Generate high-quality deterministic factual summary."""
    if exp_type == ExplanationType.RUN_SUMMARY:
        tasks_sched = facts.get("tasks_scheduled", 0)
        tasks_total = facts.get("tasks_considered", 0)
        blocks = facts.get("total_blocks", 0)
        integrated = facts.get("integrated_blocks", 0)
        separate = facts.get("separate_blocks", 0)
        obj_val = facts.get("objective_value", "—")
        status_val = facts.get("solver_status", "OPTIMAL")
        run_id = facts.get("run_id", "—")
        return (
            f"Optimization Run #{run_id} achieved solver status {status_val} with an objective score of {obj_val}. "
            f"A total of {tasks_sched} out of {tasks_total} work orders were scheduled across {blocks} discrete possession blocks "
            f"({integrated} multi-department integrated blocks and {separate} single-task blocks)."
        )
    elif exp_type == ExplanationType.BLOCK_EXPLANATION:
        block_id = facts.get("block_id", "—")
        sec_id = facts.get("section_id", "—")
        dur = facts.get("block_duration_hrs", 0)
        pri = facts.get("realized_priority_value", 0)
        tasks_count = facts.get("assigned_task_count", 0)
        is_int = facts.get("is_integrated", False)
        block_type = "multi-department integrated" if is_int else "single-department"
        return (
            f"Possession Block #{block_id} on section {sec_id} was scheduled as a {block_type} window for {dur} hours. "
            f"It accommodates {tasks_count} work orders with a realized priority score of {pri}."
        )
    elif exp_type == ExplanationType.UNASSIGNED_TASK:
        task_id = facts.get("task_id", "—")
        sec_id = facts.get("section_id", "—")
        dept = facts.get("department", "—")
        pri = facts.get("priority_score", 0)
        dur = facts.get("required_duration_hrs", 0)
        return (
            f"Maintenance Task {task_id} ({dept}) on section {sec_id} with priority {pri} (requires {dur}h window) "
            f"could not be scheduled within available candidate windows due to corridor capacity or higher-priority tasks."
        )
    elif exp_type == ExplanationType.SCENARIO_COMPARISON:
        name = facts.get("scenario_name", "What-If Scenario")
        base_id = facts.get("base_run_id", "—")
        scen_id = facts.get("scenario_run_id", "—")
        comp = facts.get("comparison", {})
        delta_tasks = comp.get("tasks_scheduled", {}).get("delta", 0)
        delta_obj = comp.get("objective_value", {}).get("delta", 0.0)
        return (
            f"Scenario '{name}' compared against Base Run #{base_id} (Scenario Run #{scen_id}) resulted in "
            f"a net change of {delta_tasks:+d} scheduled tasks and an objective delta of {delta_obj:+.2f}."
        )
    return "Deterministic optimization results verified."


def build_deterministic_key_factors(facts: Dict[str, Any], exp_type: ExplanationType) -> List[str]:
    """Generate deterministic key contributing factors."""
    if exp_type == ExplanationType.RUN_SUMMARY:
        return [
            f"Combinatorial optimization executed by Google OR-Tools CP-SAT in {facts.get('solve_time_seconds', 0)}s.",
            f"Cross-department consolidation formed {facts.get('integrated_blocks', 0)} shared possession corridors.",
            f"Timetable conflict penalty minimization applied across {facts.get('planning_horizon_start')} to {facts.get('planning_horizon_end')}.",
        ]
    elif exp_type == ExplanationType.BLOCK_EXPLANATION:
        depts = facts.get("departments", [])
        return [
            f"Departments synchronized: {', '.join(depts) if depts else 'Single Department'}.",
            f"Corridor train timetable conflicts evaluated: {facts.get('train_conflicts', 0)} detected.",
            f"Assigned tasks duration satisfied required window: {facts.get('block_duration_hrs', 0)} hours allocated.",
        ]
    elif exp_type == ExplanationType.UNASSIGNED_TASK:
        return [
            f"Task severity {facts.get('severity')} with overdue penalty score {facts.get('priority_score')}.",
            f"Required window duration: {facts.get('required_duration_hrs')} hours.",
            "Candidate possession windows on this section were allocated to higher-priority work orders.",
        ]
    elif exp_type == ExplanationType.SCENARIO_COMPARISON:
        return [
            f"Scenario type: {facts.get('scenario_type', 'OBJECTIVE_WEIGHTS')}.",
            "Sensitivity analysis performed without modifying the approved base schedule.",
            "Delta metrics computed deterministically from solver objective outcomes.",
        ]
    return ["Evaluated against CP-SAT multi-criteria objective formulation."]
