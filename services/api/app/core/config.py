"""Application configuration loaded from environment variables.

Uses Pydantic Settings to read from .env file and environment variables.
No secrets are hardcoded — all sensitive values come from the environment.
"""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


def _find_dotenv_files() -> tuple[str, ...]:
    """Locate project root .env and service-level .env files.

    Loading Precedence (Pydantic Settings):
      1. Actual process environment variables (highest priority)
      2. services/api/.env (service-specific overrides / local secrets, if present)
      3. Project root .env (authoritative defaults for DATABASE_URL, Keycloak, etc.)
    """
    current = Path(__file__).resolve().parent
    root_dir = None

    # Walk up to locate the project repository root
    temp = current
    while temp != temp.parent:
        if (temp / ".git").exists() or (temp / "services" / "api").exists() or (temp / "docker-compose.yml").exists():
            root_dir = temp
            break
        temp = temp.parent

    if not root_dir:
        root_dir = current

    files: list[str] = []
    root_env = root_dir / ".env"
    if root_env.is_file():
        files.append(str(root_env.resolve()))

    api_env = root_dir / "services" / "api" / ".env"
    if api_env.is_file() and api_env.resolve() != root_env.resolve():
        files.append(str(api_env.resolve()))

    return tuple(files) if files else (".env",)


class Settings(BaseSettings):
    """Centralised application settings.

    Values are loaded in priority order:
      1. Actual environment variables (highest priority)
      2. services/api/.env (service-level overrides)
      3. Project root .env (authoritative database & shared configuration)
    """

    model_config = SettingsConfigDict(
        env_file=_find_dotenv_files(),
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

    # ── LLM Explainability Provider Architecture ────────────────
    llm_provider: str = "auto"  # "auto" | "ollama" | "gemini" | "deterministic"

    # Ollama Local LLM
    ollama_enabled: bool = True
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "gemma2:2b"
    ollama_timeout_seconds: float = 25.0

    # Gemini Hosted LLM Fallback
    gemini_enabled: bool = True
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.5-flash"
    gemini_timeout_seconds: float = 20.0
    gemini_api_base: str = "https://generativelanguage.googleapis.com/v1beta"

    @property
    def is_development(self) -> bool:
        return self.app_env == "development"


settings = Settings()
