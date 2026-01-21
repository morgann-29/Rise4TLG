from pydantic_settings import BaseSettings
from typing import Optional
from dotenv import load_dotenv
import os

# Charger .env
load_dotenv()

class Settings(BaseSettings):
    # Application
    app_name: str = "Starter API"
    debug: bool = True
    secret_key: str = os.getenv("SECRET_KEY", "dev-secret-key")

    # Supabase
    supabase_url: str = os.getenv("SUPABASE_URL", "")
    supabase_anon_key: str = os.getenv("SUPABASE_ANON_KEY", "")
    supabase_service_key: str = os.getenv("SUPABASE_SERVICE_KEY", "")

    class Config:
        env_file = ".env"

settings = Settings()

# Verifications au demarrage
if not settings.supabase_url:
    raise ValueError("SUPABASE_URL manquant dans .env")
if not settings.supabase_anon_key:
    raise ValueError("SUPABASE_ANON_KEY manquant dans .env")
if not settings.supabase_service_key:
    raise ValueError("SUPABASE_SERVICE_KEY manquant dans .env")
