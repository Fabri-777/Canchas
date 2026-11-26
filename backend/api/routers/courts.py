from typing import Annotated

from fastapi import APIRouter, Query

from backend.api.deps import ServicesDep
from backend.api.presenters import court_json

router = APIRouter(tags=["courts"])


@router.get("/courts/")
def list_courts(services: ServicesDep):
    return {"courts": [court_json(c) for c in services.courts.list_active()]}


@router.get("/availability/")
def availability(
    services: ServicesDep,
    court: Annotated[int, Query()],
    date: Annotated[str, Query(max_length=10)],
):
    return {"slots": services.courts.availability(court, date)}
