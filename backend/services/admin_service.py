from datetime import datetime, time, timedelta
from decimal import Decimal, InvalidOperation

from backend.core.clock import LIMA, Clock, slot_start, today_in_lima
from backend.core.errors import Forbidden, InvalidInput, NotFound, require
from backend.db.database import UnitOfWork
from backend.domain.models import SPORTS, Block, Court, User
from backend.services.scheduling import check_bookable, check_free, court_or_404


def _require_admin(user: User) -> None:
    require(user.is_admin, Forbidden("Esta sección es exclusiva para administradores."))


class AdminService:
    def __init__(self, uow: UnitOfWork, clock: Clock):
        self.uow = uow
        self.clock = clock

    def overview(self, admin: User) -> dict:
        _require_admin(admin)
        now = self.clock.now()
        day_start = datetime.combine(today_in_lima(now), time(0), tzinfo=LIMA)
        day_end = day_start + timedelta(days=1)
        with self.uow() as repos:
            return {
                "bookings": repos.bookings.list(),
                "courts": repos.courts.list(),
                "users": repos.users.customers(),
                "blocks": repos.blocks.upcoming(now),
                "stats": {
                    "today": repos.bookings.count_status("confirmed", day_start, day_end),
                    "review": repos.bookings.count_status("review"),
                    "income": repos.bookings.total_paid(),
                },
            }

    def save_court(self, admin: User, data: dict) -> Court:
        _require_admin(admin)
        court = self._validated_court(data)
        with self.uow() as repos:
            if court.id is not None:
                court_or_404(repos, court.id, lock=True)
            return repos.courts.save(court)

    def create_block(self, admin: User, court_id: int, day: str, hour: int, reason: str) -> Block:
        _require_admin(admin)
        reason = (reason or "").strip()
        require(3 <= len(reason) <= 120, InvalidInput("Escribe un motivo de entre 3 y 120 caracteres."))
        start = slot_start(day, hour)
        with self.uow() as repos:
            court = court_or_404(repos, court_id, lock=True)
            check_bookable(court, start, self.clock.now())
            check_free(repos, court.id, start, "Este horario ya tiene una reserva o un bloqueo.")
            return repos.blocks.add(Block(id=None, court_id=court.id, start_at=start, reason=reason))

    def delete_block(self, admin: User, block_id: int) -> None:
        _require_admin(admin)
        with self.uow() as repos:
            require(repos.blocks.remove(block_id), NotFound("Este bloqueo ya no existe."))

    @staticmethod
    def _validated_court(data: dict) -> Court:
        error = InvalidInput(
            "Revisa los datos: precio positivo, capacidad entre 2 y 30, "
            "apertura anterior al cierre (0–24)."
        )
        try:
            price = Decimal(str(data["price"])).quantize(Decimal("0.01"))
        except (InvalidOperation, KeyError):
            raise error from None
        court = Court(
            id=data.get("id"), name=(data.get("name") or "").strip(), sport=data.get("sport"),
            description=(data.get("description") or "").strip(),
            district=(data.get("district") or "").strip(), price=price,
            capacity=data.get("capacity"), opens_at=data.get("opens_at"),
            closes_at=data.get("closes_at"), active=bool(data.get("active")),
        )
        require(
            0 < len(court.name) <= 80 and 0 < len(court.description) <= 180
            and 0 < len(court.district) <= 70 and court.sport in SPORTS
            and 0 < court.price <= 999999 and 2 <= court.capacity <= 30
            and 0 <= court.opens_at < court.closes_at <= 24,
            error,
        )
        return court
