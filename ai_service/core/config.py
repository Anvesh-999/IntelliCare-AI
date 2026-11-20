import os
import re
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    """
    IntelliCare AI Configuration settings loaded securely from environment variables.
    """
    ENVIRONMENT: str = "development"
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    
    # LLM Provider Configuration
    LLM_PROVIDER: str = "gemini"  # Supported: "gemini", "mock", "openai"
    GEMINI_API_KEY: Optional[str] = None
    GOOGLE_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-3.8-flash"
    GEMINI_FALLBACK_MODEL: str = "gemini-3.8-flash"
    
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4o-mini"
    
    # Generation parameters
    LLM_TEMPERATURE: float = 0.2
    LLM_MAX_OUTPUT_TOKENS: int = 1024
    LLM_TIMEOUT_SECONDS: float = 25.0
    LLM_MAX_RETRIES: int = 3
    LLM_RETRY_DELAY_SECONDS: float = 1.0
    
    # Security & Guardrails
    MAX_INPUT_LENGTH: int = 4000
    INTERNAL_SERVICE_TOKEN: str = "intellicare_internal_ai_secret_token_2026"
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:5000,https://intelli-care-ai-dalt.vercel.app"

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def effective_gemini_key(self) -> Optional[str]:
        """Resolves GEMINI_API_KEY or GOOGLE_API_KEY from environment."""
        key = self.GEMINI_API_KEY or self.GOOGLE_API_KEY or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if key and key.strip() and not key.startswith("your_"):
            return key.strip()
        return None

def mask_secret(secret: Optional[str], visible_chars: int = 4) -> str:
    """Masks sensitive credentials for safe logging."""
    if not secret:
        return "<not set>"
    if len(secret) <= visible_chars * 2:
        return "***"
    return f"{secret[:visible_chars]}...{secret[-visible_chars:]}"

def sanitize_for_logs(text: str) -> str:
    """Removes potential secrets or sensitive identifiers from log outputs."""
    # Mask API key patterns
    text = re.sub(r'AIza[0-9A-Za-z-_]{20,}', '[MASKED_GEMINI_KEY]', text)
    text = re.sub(r'sk-[0-9A-Za-z-_]{20,}', '[MASKED_OPENAI_KEY]', text)
    # Mask SSN / phone patterns if present
    text = re.sub(r'\b\d{3}-\d{2}-\d{4}\b', '[MASKED_SSN]', text)
    return text

settings = Settings()
