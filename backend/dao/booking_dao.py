from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import exists, func, select, update

from backend.dao.base import BaseDAO
from backend.db.tables import bookings, courts, payments, users

# Columns for list views: everything except the receipt image, which can weigh megabytes.
_DETAIL_COLUMNS = (
    bookings,
    payments.c.method.label("payment_method"),
    payments.c.status.label("payment_status"),
    payments.c.receipt_type.isnot(None).label("has_receipt"),
    courts.c.name.label("court_name"),
    courts.c.sport.label("court_sport"),
    courts.c.description.label("court_description"),
    courts.c.district.label("court_district"),
    courts.c.price.label("court_price"),
    courts.c.capacity.label("court_capacity"),
    courts.c.opens_at.label("court_opens_at"),
    courts.c.closes_at.label("court_closes_at"),
    courts.c.active.label("court_active"),
    users.c.name.label("customer"),
)


def _details_query():
    return (
        select(*_DETAIL_COLUMNS)
        .join(payments, payments.c.booking_id == bookings.c.id)
        .join(courts, courts.c.id == bookings.c.court_id)
        .join(users, users.c.id == bookings.c.user_id)
    )


class BookingDAO(BaseDAO):
    table = bookings

    def find_details(self, booking_id: int, for_update: bool = False):
        query = _details_query().where(bookings.c.id == booking_id)
        if for_update:
            query = query.with_for_update(of=bookings)
        return self.conn.execute(query).mappings().first()

    def list_details(self, user_id: int | None = None):
        query = _details_query().order_by(bookings.c.start_at.desc(), bookings.c.id.desc())
        if user_id is not None:
            query = query.where(bookings.c.user_id == user_id)
        return self.conn.execute(query).mappings().all()

    def slot_taken(self, court_id: int, start_at: datetime, statuses: Sequence[str]) -> bool:
        query = select(
            exists().where(
                bookings.c.court_id == court_id,
                bookings.c.start_at == start_at,
                bookings.c.status.in_(statuses),
            )
        )
        return bool(self.conn.execute(query).scalar())

    def taken_starts(self, court_id: int, start: datetime, end: datetime, statuses: Sequence[str]):
        query = select(bookings.c.start_at).where(
            bookings.c.court_id == court_id,
            bookings.c.start_at >= start,
            bookings.c.start_at < end,
            bookings.c.status.in_(statuses),
        )
        return set(self.conn.execute(query).scalars().all())

    def expire_pending(self, now: datetime) -> int:
        query = (
            update(bookings)
            .where(bookings.c.status == "pending", bookings.c.expires_at <= now)
            .values(status="expired")
        )
        return self.conn.execute(query).rowcount

    def count_by_status(self, status: str, start: datetime | None = None, end: datetime | None = None) -> int:
        query = select(func.count()).select_from(bookings).where(bookings.c.status == status)
        if start is not None and end is not None:
            query = query.where(bookings.c.start_at >= start, bookings.c.start_at < end)
        return self.conn.execute(query).scalar_one()

    def sum_paid(self):
        query = (
            select(func.coalesce(func.sum(bookings.c.total), 0))
            .join(payments, payments.c.booking_id == bookings.c.id)
            .where(payments.c.status == "paid")
        )
        return self.conn.execute(query).scalar_one()
