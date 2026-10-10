from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.routes import predict
from app.core.config import settings
from app.ml.registry import Registry


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not settings.internal_key:
        raise RuntimeError("ENGINE_INTERNAL_KEY belum diisi (lihat engine/.env.example)")
    app.state.registry = Registry(settings.models_dir)  # model dimuat sekali di sini
    print("[engine] model termuat:", app.state.registry.status())
    yield


app = FastAPI(title="AgroChie Engine", lifespan=lifespan)
app.include_router(predict.router)


@app.get("/health")
def health():
    return {"ok": True, "models": app.state.registry.status()}