from datetime import datetime

from sqlalchemy import exists, select, update

from backend.dao.base import BaseDAO
from backend.db.tables import bookings, notifications, users


class NotificationDAO(BaseDAO):
    table = notifications

    def exists_for(self, booking_id: int, kind: str) -> bool:
        query = select(
            exists().where(notifications.c.booking_id == booking_id, notifications.c.kind == kind)
        )
        return bool(self.conn.execute(query).scalar())

    def list(self, user_id: int | None = None):
        query = (
            select(notifications, users.c.name.label("customer"))
            .join(bookings, bookings.c.id == notifications.c.booking_id)
            .join(users, users.c.id == bookings.c.user_id)
            .order_by(notifications.c.scheduled_at.desc(), notifications.c.id.desc())
        )
        if user_id is not None:
            query = query.where(bookings.c.user_id == user_id)
        return self.conn.execute(query).mappings().all()

    def cancel_scheduled(self, booking_id: int) -> None:
        self.conn.execute(
            update(notifications)
            .where(notifications.c.booking_id == booking_id, notifications.c.status == "scheduled")
            .values(status="cancelled")
        )

    def deliver_due(self, now: datetime) -> None:
        """Scheduled messages that are due become 'simulated' if the booking is still confirmed."""
        confirmed = select(bookings.c.id).where(bookings.c.status == "confirmed")
        due = (notifications.c.status == "scheduled", notifications.c.scheduled_at <= now)
        self.conn.execute(
            update(notifications)
            .where(*due, notifications.c.booking_id.in_(confirmed))
            .values(status="simulated")
        )
        self.conn.execute(update(notifications).where(*due).values(status="cancelled"))
