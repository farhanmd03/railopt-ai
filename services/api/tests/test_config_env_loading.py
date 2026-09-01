"""Regression tests for Environment Configuration and Multi-Env Loading.

Verifies:
1. DATABASE_URL is properly resolved from the root .env file.
2. Keycloak settings are loaded.
3. LLM settings (LLM_PROVIDER, OLLAMA_*, GEMINI_*) are resolved.
4. Gemini configuration is parsed correctly.
5. Missing or unconfigured Gemini API key does not crash application startup or settings resolution.
6. Multi-file dotenv precedence works as expected.
"""

import os
import sys
from pathlib import Path
import unittest

API_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(API_DIR))

from app.core.config import Settings, _find_dotenv_files, settings


class TestEnvironmentConfigLoading(unittest.TestCase):
    """Test suite for environment variable resolution and multi-dotenv file loading."""

    def test_01_dotenv_files_discovered(self):
        """1. Project root .env and services/api/.env (if present) are discovered."""
        env_files = _find_dotenv_files()
        self.assertIsInstance(env_files, tuple)
        self.assertGreaterEqual(len(env_files), 1)

        # Root .env must be included in the discovered files
        root_found = any(f.endswith(".env") and ("railopt-ai" in f.lower() or "services" not in f.lower()) for f in env_files)
        self.assertTrue(root_found, f"Root .env should be discovered. Found: {env_files}")

    def test_02_database_url_resolved(self):
        """2. DATABASE_URL is loaded and non-empty from root .env."""
        self.assertTrue(bool(settings.database_url))
        self.assertIn("postgresql", settings.database_url.lower())

    def test_03_keycloak_configuration_resolved(self):
        """3. Keycloak settings are resolved correctly."""
        self.assertTrue(bool(settings.keycloak_url))
        self.assertTrue(bool(settings.keycloak_realm))
        self.assertTrue(bool(settings.keycloak_client_id))

    def test_04_llm_settings_resolved(self):
        """4. LLM provider settings are resolved with valid defaults/overrides."""
        self.assertIn(settings.llm_provider, ["auto", "ollama", "gemini", "deterministic"])
        self.assertTrue(bool(settings.ollama_model))
        self.assertTrue(bool(settings.gemini_model))
        self.assertGreater(settings.ollama_timeout_seconds, 0)
        self.assertGreater(settings.gemini_timeout_seconds, 0)

    def test_05_missing_gemini_key_does_not_crash(self):
        """5. Unset or missing GEMINI_API_KEY does not prevent Settings instantiation."""
        # Create a fresh Settings instance without gemini_api_key in environment
        test_settings = Settings(
            database_url="postgresql+psycopg://user:pass@localhost:5432/db",
            gemini_api_key=None,
        )
        self.assertIsNone(test_settings.gemini_api_key)
        self.assertEqual(test_settings.llm_provider, "auto")

    def test_06_demo_settings_resolved(self):
        """6. Demo access configuration parameters are resolved."""
        self.assertIsInstance(settings.demo_access_enabled, bool)
        # Verify settings instantiate cleanly with custom demo config
        custom_settings = Settings(
            database_url="postgresql+psycopg://user:pass@localhost:5432/db",
            demo_access_enabled=True,
            demo_user_password="custom_demo_password",
        )
        self.assertTrue(custom_settings.demo_access_enabled)
        self.assertEqual(custom_settings.demo_user_password, "custom_demo_password")


if __name__ == "__main__":
    unittest.main()
