import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()  # baca engine/.env

BASE_DIR = Path(__file__).resolve().parents[2]  # folder engine/


class Settings:
    # folder berisi artefak model hasil training (di-copy dari direktori training)
    models_dir = Path(os.getenv("MODELS_DIR", BASE_DIR / "models"))
    # kunci rahasia bersama dengan backend Express; engine TIDAK boleh terbuka tanpa ini
    internal_key = os.getenv("ENGINE_INTERNAL_KEY", "")


settings = Settings()