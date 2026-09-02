"""Application configuration loaded from environment variables.

Uses Pydantic Settings to read from .env file and environment variables.
No secrets are hardcoded — all sensitive values come from the environment.
"""

from pathlib import Path

from pydantic import field_validator, model_validator
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

    @field_validator("database_url", mode="after")
    @classmethod
    def _normalize_database_url(cls, v: str) -> str:
        """Normalize PostgreSQL URL for psycopg3 async/sync engine compatibility.

        Cloud hosts (Supabase, Render) often supply plain 'postgresql://' or 'postgres://'.
        SQLAlchemy's default driver for un-drivered 'postgresql://' is sync 'psycopg2'.
        Normalizing to 'postgresql+psycopg://' routes directly to the installed psycopg v3 driver,
        while preserving explicit schemes like 'postgresql+asyncpg://'.
        """
        if not v:
            return v
        if v.startswith("postgres://"):
            return "postgresql+psycopg://" + v[len("postgres://"):]
        if v.startswith("postgresql://") and not v.startswith("postgresql+"):
            return "postgresql+psycopg://" + v[len("postgresql://"):]
        return v

    # ── Generic OIDC / Auth0 / Keycloak Authentication ──────────
    oidc_issuer_url: str | None = None
    oidc_client_id: str | None = None
    oidc_audience: str | None = None
    oidc_jwks_url: str | None = None

    # Keycloak Legacy Fallbacks
    keycloak_url: str = "http://localhost:8080"
    keycloak_realm: str = "railopt"
    keycloak_client_id: str = "railopt-web"

    @property
    def effective_oidc_issuer(self) -> str:
        """Resolve effective OIDC issuer (prefers generic OIDC_ISSUER_URL)."""
        if self.oidc_issuer_url:
            return self.oidc_issuer_url.strip()
        base = self.keycloak_url.rstrip("/")
        return f"{base}/realms/{self.keycloak_realm}"

    @property
    def effective_oidc_client_id(self) -> str:
        """Resolve effective OIDC client ID."""
        return (self.oidc_client_id or self.keycloak_client_id).strip()

    @property
    def effective_oidc_audience(self) -> str:
        """Resolve target API audience for token validation."""
        if self.oidc_audience:
            return self.oidc_audience.strip()
        return self.effective_oidc_client_id

    @property
    def effective_oidc_jwks_url(self) -> str:
        """Resolve JWKS endpoint URL."""
        if self.oidc_jwks_url:
            return self.oidc_jwks_url.strip()
        if self.oidc_issuer_url:
            return f"{self.oidc_issuer_url.rstrip('/')}/.well-known/jwks.json"
        base = self.keycloak_url.rstrip("/")
        if "localhost" in base:
            base = base.replace("localhost", "127.0.0.1")
        return f"{base}/realms/{self.keycloak_realm}/protocol/openid-connect/certs"

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

    # ── Demo Access Configuration (Evaluation Only) ──────────────
    demo_access_enabled: bool = False
    demo_user_password: str | None = None
    demo_jwt_secret: str = "railopt-demo-secret-key-do-not-use-in-production-without-env"
    demo_jwt_issuer: str = "railopt-demo"
    demo_jwt_expiry_seconds: int = 28800  # 8 hours for evaluation session

    @model_validator(mode="after")
    def _validate_production_demo_secret(self) -> "Settings":
        """Enforce strong non-default DEMO_JWT_SECRET in production environments."""
        insecure_default = "railopt-demo-secret-key-do-not-use-in-production-without-env"
        if self.demo_access_enabled and not self.is_development:
            if not self.demo_jwt_secret or self.demo_jwt_secret == insecure_default or len(self.demo_jwt_secret) < 32:
                raise ValueError(
                    "Production startup rejected: DEMO_ACCESS_ENABLED=true in non-development environment, "
                    "but DEMO_JWT_SECRET is missing, set to the insecure default, or shorter than 32 characters. "
                    "Configure a strong DEMO_JWT_SECRET on the server."
                )
        return self

    @property
    def is_development(self) -> bool:
        return self.app_env == "development"


settings = Settings()
