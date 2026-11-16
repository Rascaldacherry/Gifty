from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(BACKEND_DIR.parent / ".env", BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = f"sqlite:///{(BACKEND_DIR / 'gifty.db').as_posix()}"
    app_env: str = "development"
    frontend_origin: str = "http://localhost:3000"
    cookie_secure: bool = False
    session_days: int = 14
    demo_enabled: bool = True
    ai_provider: str = "demo"
    external_processing_enabled: bool = False
    ai_api_key: str = ""
    ai_base_url: str = ""
    ai_model: str = ""
    yandex_folder_id: str = ""
    gigachat_access_token: str = ""
    speechkit_api_key: str = ""
    speechkit_folder_id: str = ""
    ozon_catalog_file: str = ""
    wildberries_catalog_file: str = ""
    yandex_market_catalog_file: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
