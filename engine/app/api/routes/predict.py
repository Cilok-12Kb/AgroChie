from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_registry, require_internal_key
from app.ml.predictors import predict_cost
from app.schemas.predict import CostRequest, LeafRequest

router = APIRouter(prefix="/predict", dependencies=[Depends(require_internal_key)])


@router.post("/cost")
def cost(body: CostRequest, reg=Depends(get_registry)):
    if not (reg.season and reg.weekly):
        raise HTTPException(503, "Model biaya belum dimuat")
    return predict_cost(reg, body.model_dump())


@router.post("/leaf")
def leaf(body: LeafRequest, reg=Depends(get_registry)):
    if not reg.leaf:
        raise HTTPException(503, "Model kualitas tanaman belum dimuat")
    try:
        return {**reg.leaf.predict(body.image_base64), "model": reg.leaf.version}
    except Exception:
        raise HTTPException(422, "Gambar tidak bisa dibaca")