from backend.core.clock import HOUR, Clock, slot_start
from backend.db.database import UnitOfWork
from backend.domain.models import Court
from backend.services.scheduling import BOOKING_WINDOW, court_or_404


class CourtService:
    def __init__(self, uow: UnitOfWork, clock: Clock):
        self.uow = uow
        self.clock = clock

    def list_active(self) -> list[Court]:
        with self.uow() as repos:
            return repos.courts.list(only_active=True)

    def availability(self, court_id: int, day: str) -> list[dict]:
        """One entry per opening hour: available | booked | blocked | past."""
        now = self.clock.now()
        with self.uow() as repos:
            court = court_or_404(repos, court_id)
            hours = range(court.opens_at, court.closes_at)
            starts = {hour: slot_start(day, hour) for hour in hours}
            if not starts:
                return []
            first, last = min(starts.values()), max(starts.values()) + HOUR
            # Two queries for the whole day instead of two per slot.
            booked = repos.bookings.taken_starts(court.id, first, last)
            blocked = repos.blocks.starts_between(court.id, first, last)

        def state(start) -> str:
            if not court.active or start <= now or start > now + BOOKING_WINDOW:
                return "past"
            if start in blocked:
                return "blocked"
            return "booked" if start in booked else "available"

        return [{"hour": hour, "state": state(start)} for hour, start in starts.items()]
