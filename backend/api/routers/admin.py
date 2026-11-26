from fastapi import APIRouter

from backend.api.deps import CurrentAdmin, ServicesDep
from backend.api.presenters import block_json, booking_json, court_json, user_json
from backend.api.schemas import BlockDeleteIn, BlockIn, CourtIn

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/overview/")
def overview(admin: CurrentAdmin, services: ServicesDep):
    data = services.admin.overview(admin)
    return {
        "bookings": [booking_json(b) for b in data["bookings"]],
        "courts": [court_json(c) for c in data["courts"]],
        "users": [user_json(u) for u in data["users"]],
        "blocks": [block_json(b) for b in data["blocks"]],
        "stats": {**data["stats"], "income": float(data["stats"]["income"])},
    }


@router.post("/courts/")
def save_court(body: CourtIn, admin: CurrentAdmin, services: ServicesDep):
    return {"court": court_json(services.admin.save_court(admin, body.model_dump()))}


@router.post("/blocks/", status_code=201)
def create_block(body: BlockIn, admin: CurrentAdmin, services: ServicesDep):
    block = services.admin.create_block(admin, body.court_id, body.date, body.hour, body.reason)
    return {"ok": True, "block": {"id": block.id}}


@router.delete("/blocks/")
def delete_block(body: BlockDeleteIn, admin: CurrentAdmin, services: ServicesDep):
    services.admin.delete_block(admin, body.id)
    return {"ok": True}
