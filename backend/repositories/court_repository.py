from dataclasses import asdict
from decimal import Decimal

from sqlalchemy import Connection

from backend.dao.court_dao import CourtDAO
from backend.domain.models import Court


def to_court(row, prefix: str = "") -> Court:
    key = (lambda name: f"{prefix}{name}") if prefix else (lambda name: name)
    return Court(
        id=row["court_id" if prefix else "id"],
        name=row[key("name")], sport=row[key("sport")], description=row[key("description")],
        district=row[key("district")], price=Decimal(row[key("price")]),
        capacity=row[key("capacity")], opens_at=row[key("opens_at")],
        closes_at=row[key("closes_at")], active=bool(row[key("active")]),
    )


class CourtRepository:
    def __init__(self, conn: Connection):
        self.dao = CourtDAO(conn)

    def get(self, court_id: int, lock: bool = False) -> Court | None:
        row = self.dao.find_by_id(court_id, for_update=lock)
        return to_court(row) if row else None

    def list(self, only_active: bool = False) -> list[Court]:
        return [to_court(row) for row in self.dao.list(only_active)]

    def save(self, court: Court) -> Court:
        values = {k: v for k, v in asdict(court).items() if k != "id"}
        if court.id is None:
            court.id = self.dao.insert(**values)
        else:
            self.dao.update(court.id, **values)
        return court
