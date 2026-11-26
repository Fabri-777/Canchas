"""Application settings loaded from environment variables (and an optional .env file)."""
import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent

load_dotenv(PROJECT_ROOT / ".env")


def _flag(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    database_url: str = os.getenv(
        # Matches database/setup_mysql.sql, so the app runs without a .env file.
        "DATABASE_URL",
        "mysql+pymysql://canchas_app:canchas123@127.0.0.1:3306/canchas?charset=utf8mb4",
    )
    session_cookie: str = "cancha_session"
    session_hours: int = int(os.getenv("SESSION_HOURS", "12"))
    secure_cookies: bool = _flag("SECURE_COOKIES", False)
    demo_mode: bool = _flag("DEMO_MODE", True)
    frontend_dir: Path = PROJECT_ROOT
