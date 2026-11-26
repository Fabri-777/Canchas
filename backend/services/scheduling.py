"""Slot rules shared by bookings and admin blocks."""
from datetime import datetime, timedelta

from backend.core.clock import lima_hour
from backend.core.errors import Conflict, InvalidInput, NotFound, require
from backend.domain.models import Court
from backend.repositories import Repositories

BOOKING_WINDOW = timedelta(days=60)


def court_or_404(repos: Repositories, court_id: int, lock: bool = False) -> Court:
    court = repos.courts.get(court_id, lock=lock)
    require(court, NotFound("La cancha ya no está disponible."))
    return court


def check_bookable(court: Court, start: datetime, now: datetime) -> None:
    require(
        now < start <= now + BOOKING_WINDOW,
        InvalidInput("Puedes reservar horarios futuros dentro de los próximos 60 días."),
    )
    require(
        court.active and court.opens_at <= lima_hour(start) < court.closes_at,
        InvalidInput("La cancha no está disponible en ese horario."),
    )


def check_free(repos: Repositories, court_id: int, start: datetime, message: str) -> None:
    taken = repos.bookings.is_taken(court_id, start) or repos.blocks.exists_at(court_id, start)
    require(not taken, Conflict(message))
