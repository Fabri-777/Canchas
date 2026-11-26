from datetime import datetime

from sqlalchemy import Connection

from backend.core.clock import from_db, to_db
from backend.dao.notification_dao import NotificationDAO
from backend.domain.models import Notification


class NotificationRepository:
    def __init__(self, conn: Connection):
        self.dao = NotificationDAO(conn)

    def add_once(self, notification: Notification) -> None:
        """One message per (booking, kind): confirming twice never duplicates a message."""
        if self.dao.exists_for(notification.booking_id, notification.kind):
            return
        self.dao.insert(
            booking_id=notification.booking_id, kind=notification.kind, text=notification.text,
            channel=notification.channel, scheduled_at=to_db(notification.scheduled_at),
            status=notification.status,
        )

    def list(self, user_id: int | None = None) -> list[Notification]:
        return [
            Notification(
                id=row["id"], booking_id=row["booking_id"], kind=row["kind"], text=row["text"],
                channel=row["channel"], scheduled_at=from_db(row["scheduled_at"]),
                status=row["status"], booking_code=f"CN-{row['booking_id']:05d}",
                customer=row["customer"],
            )
            for row in self.dao.list(user_id)
        ]

    def cancel_scheduled(self, booking_id: int) -> None:
        self.dao.cancel_scheduled(booking_id)

    def deliver_due(self, now: datetime) -> None:
        self.dao.deliver_due(to_db(now))
