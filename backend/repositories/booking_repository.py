from datetime import datetime
from decimal import Decimal

from sqlalchemy import Connection

from backend.core.clock import from_db, to_db
from backend.dao.booking_dao import BookingDAO
from backend.dao.payment_dao import PaymentDAO
from backend.domain.models import ACTIVE_STATUSES, Booking, BookingDetails, Payment
from backend.repositories.court_repository import to_court


def _to_details(row) -> BookingDetails:
    booking = Booking(
        id=row["id"], user_id=row["user_id"], court_id=row["court_id"],
        start_at=from_db(row["start_at"]), total=Decimal(row["total"]), status=row["status"],
        expires_at=from_db(row["expires_at"]),
        payment=Payment(row["payment_method"], row["payment_status"], bool(row["has_receipt"])),
    )
    return BookingDetails(booking=booking, court=to_court(row, prefix="court_"), customer=row["customer"])


class BookingRepository:
    """Booking aggregate = bookings row + its payments row, always saved together."""

    def __init__(self, conn: Connection):
        self.bookings = BookingDAO(conn)
        self.payments = PaymentDAO(conn)

    def get(self, booking_id: int, lock: bool = False) -> BookingDetails | None:
        row = self.bookings.find_details(booking_id, for_update=lock)
        return _to_details(row) if row else None

    def list(self, user_id: int | None = None) -> list[BookingDetails]:
        return [_to_details(row) for row in self.bookings.list_details(user_id)]

    def add(self, booking: Booking, now: datetime) -> Booking:
        booking.id = self.bookings.insert(
            user_id=booking.user_id, court_id=booking.court_id, start_at=to_db(booking.start_at),
            total=booking.total, status=booking.status, expires_at=to_db(booking.expires_at),
            created_at=to_db(now),
        )
        self.payments.insert(
            booking_id=booking.id, method=booking.payment.method, status=booking.payment.status
        )
        return booking

    def save_status(self, booking: Booking) -> None:
        self.bookings.update(booking.id, status=booking.status)
        self.payments.update(booking.id, status=booking.payment.status)

    def attach_receipt(self, booking_id: int, content: bytes, content_type: str) -> None:
        self.payments.update(booking_id, receipt=content, receipt_type=content_type)

    def receipt(self, booking_id: int) -> tuple[bytes, str] | None:
        row = self.payments.find_receipt(booking_id)
        if not row or row["receipt"] is None:
            return None
        return bytes(row["receipt"]), row["receipt_type"]

    def is_taken(self, court_id: int, start_at: datetime) -> bool:
        return self.bookings.slot_taken(court_id, to_db(start_at), ACTIVE_STATUSES)

    def taken_starts(self, court_id: int, start: datetime, end: datetime) -> set[datetime]:
        rows = self.bookings.taken_starts(court_id, to_db(start), to_db(end), ACTIVE_STATUSES)
        return {from_db(value) for value in rows}

    def expire_pending(self, now: datetime) -> int:
        return self.bookings.expire_pending(to_db(now))

    def count_status(self, status: str, start: datetime | None = None, end: datetime | None = None) -> int:
        if start is None or end is None:
            return self.bookings.count_by_status(status)
        return self.bookings.count_by_status(status, to_db(start), to_db(end))

    def total_paid(self) -> Decimal:
        return Decimal(self.bookings.sum_paid())
