"""Application configuration loaded from environment variables.

Uses Pydantic Settings to read from .env file and environment variables.
No secrets are hardcoded — all sensitive values come from the environment.
"""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


def _find_dotenv() -> str:
    """Walk up from this file's directory to locate the project-root .env file."""
    current = Path(__file__).resolve().parent
    while current != current.parent:
        candidate = current / ".env"
        if candidate.is_file():
            return str(candidate)
        current = current.parent
    return ".env"


class Settings(BaseSettings):
    """Centralised application settings.

    Values are loaded in priority order:
      1. Actual environment variables (highest priority)
      2. .env file found by ``_find_dotenv()``
    """

    model_config = SettingsConfigDict(
        env_file=_find_dotenv(),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── Application ──────────────────────────────────────────────
    app_name: str = "RailOpt AI"
    app_env: str = "development"

    # ── Database ─────────────────────────────────────────────────
    database_url: str

    # ── Keycloak (loaded for future batches) ─────────────────────
    keycloak_url: str = "http://localhost:8080"
    keycloak_realm: str = "railopt"
    keycloak_client_id: str = "railopt-web"

    # ── Ollama Explainability (Batch 7L) ─────────────────────────
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2:1b"
    ollama_timeout_seconds: float = 25.0

    @property
    def is_development(self) -> bool:
        return self.app_env == "development"


settings = Settings()
