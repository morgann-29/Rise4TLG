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
    supabase_publishable_key: str = os.getenv("SUPABASE_PUBLISHABLE_KEY", "")
    supabase_secret_key: str = os.getenv("SUPABASE_SECRET_KEY", "")

    class Config:
        env_file = ".env"

settings = Settings()

# Verifications au demarrage
if not settings.supabase_url:
    raise ValueError("SUPABASE_URL manquant dans .env")
if not settings.supabase_publishable_key:
    raise ValueError("SUPABASE_PUBLISHABLE_KEY manquant dans .env")
if not settings.supabase_secret_key:
    raise ValueError("SUPABASE_SECRET_KEY manquant dans .env")
