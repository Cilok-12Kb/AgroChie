import secrets

from fastapi import Header, HTTPException, Request

from app.core.config import settings


def require_internal_key(x_internal_key: str = Header(default="")) -> None:
    """Hanya backend Express (yang tahu kuncinya) boleh memanggil engine."""
    if not settings.internal_key or not secrets.compare_digest(x_internal_key, settings.internal_key):
        raise HTTPException(status_code=401, detail="Tidak diizinkan")


def get_registry(request: Request):
    return request.app.state.registry