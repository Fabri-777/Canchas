"""Domain entities: plain dataclasses with no knowledge of HTTP or SQL."""
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from backend.core.clock import HOUR

SPORTS = {"futbol": "Fútbol", "voley": "Vóley", "basket": "Básquet"}
ACTIVE_STATUSES = ("pending", "review", "confirmed")
BOOKING_STATUS = {
    "pending": "Pendiente de pago",
    "review": "En revisión",
    "confirmed": "Confirmada",
    "cancelled": "Cancelada",
    "expired": "Vencida",
}
PAYMENT_METHODS = {"visa": "Visa", "mastercard": "Mastercard", "transfer": "Transferencia"}
PAYMENT_STATUS = {
    "pending": "Pendiente",
    "review": "En revisión",
    "paid": "Pagado",
    "rejected": "Rechazado",
    "refunded": "Reembolso simulado",
}


@dataclass
class User:
    id: int
    name: str
    email: str
    phone: str
    is_admin: bool
    password_hash: str | None = None
    password_salt: str | None = None


@dataclass
class Court:
    id: int | None
    name: str
    sport: str
    description: str
    district: str
    price: Decimal
    capacity: int
    opens_at: int
    closes_at: int
    active: bool

    @property
    def sport_label(self) -> str:
        return SPORTS.get(self.sport, self.sport)


@dataclass
class Payment:
    method: str
    status: str
    has_receipt: bool = False


@dataclass
class Booking:
    id: int | None
    user_id: int
    court_id: int
    start_at: datetime
    total: Decimal
    status: str
    expires_at: datetime
    payment: Payment

    @property
    def code(self) -> str:
        return f"CN-{self.id:05d}"

    @property
    def end_at(self) -> datetime:
        return self.start_at + HOUR

    @property
    def is_active(self) -> bool:
        return self.status in ACTIVE_STATUSES


@dataclass
class BookingDetails:
    """Read model: a booking with the data the UI shows next to it."""

    booking: Booking
    court: Court
    customer: str


@dataclass
class Block:
    id: int | None
    court_id: int
    start_at: datetime
    reason: str
    court_name: str = ""


@dataclass
class Notification:
    id: int | None
    booking_id: int
    kind: str
    text: str
    channel: str
    scheduled_at: datetime
    status: str
    booking_code: str = ""
    customer: str = ""
