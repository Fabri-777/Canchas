from datetime import timedelta

from backend.core.clock import HOUR, Clock, short_lima, slot_start
from backend.core.errors import Forbidden, InvalidInput, NotFound, require
from backend.db.database import UnitOfWork
from backend.domain.models import (
    PAYMENT_METHODS,
    Booking,
    BookingDetails,
    Notification,
    Payment,
    User,
)
from backend.repositories import Repositories
from backend.services.scheduling import check_bookable, check_free, court_or_404
from backend.services.validators import image_type

PAYMENT_WINDOW = timedelta(minutes=15)
CANCEL_NOTICE = 2 * HOUR


class BookingService:
    def __init__(self, uow: UnitOfWork, clock: Clock):
        self.uow = uow
        self.clock = clock

    # ---- housekeeping -------------------------------------------------------
    def process_due(self) -> None:
        """Expire unpaid bookings and deliver due reminders (runs before each API request)."""
        now = self.clock.now()
        with self.uow() as repos:
            repos.bookings.expire_pending(now)
            repos.notifications.deliver_due(now)

    # ---- customer use cases ---------------------------------------------------
    def create(self, user: User, court_id: int, day: str, hour: int, method: str) -> BookingDetails:
        require(method in PAYMENT_METHODS, InvalidInput("Selecciona un medio de pago válido."))
        start = slot_start(day, hour)
        with self.uow() as repos:
            # Locking the court row serializes concurrent bookings for that court (no double booking).
            court = court_or_404(repos, court_id, lock=True)
            now = self.clock.now()  # read after the lock: waiting on it must not extend the window
            check_bookable(court, start, now)
            check_free(repos, court.id, start, "Este horario ya tiene una reserva o un bloqueo. Selecciona otro.")
            booking = repos.bookings.add(
                Booking(
                    id=None, user_id=user.id, court_id=court.id, start_at=start, total=court.price,
                    status="pending", expires_at=min(start, now + PAYMENT_WINDOW),
                    payment=Payment(method=method, status="pending"),
                ),
                now,
            )
            return repos.bookings.get(booking.id)

    def list_for(self, user: User) -> list[BookingDetails]:
        with self.uow() as repos:
            return repos.bookings.list(user_id=user.id)

    def pay(self, user: User, booking_id: int, result: str) -> BookingDetails:
        require(result in ("approved", "rejected"), InvalidInput("Resultado de pago inválido."))
        with self.uow() as repos:
            details = self._owned_pending(repos, user, booking_id)
            booking = details.booking
            require(
                booking.payment.method != "transfer",
                InvalidInput("Adjunta un comprobante para pagar por transferencia."),
            )
            if result == "approved":
                self._confirm(repos, details)
            else:
                booking.payment.status = "rejected"
                repos.bookings.save_status(booking)
            return repos.bookings.get(booking_id)

    def upload_receipt(self, user: User, booking_id: int, content: bytes) -> BookingDetails:
        mime = image_type(content)
        with self.uow() as repos:
            booking = self._owned_pending(repos, user, booking_id).booking
            require(
                booking.payment.method == "transfer",
                InvalidInput("Esta reserva no se paga por transferencia."),
            )
            repos.bookings.attach_receipt(booking.id, content, mime)
            booking.status = booking.payment.status = "review"
            repos.bookings.save_status(booking)
            return repos.bookings.get(booking_id)

    def receipt(self, user: User, booking_id: int) -> tuple[bytes, str]:
        with self.uow() as repos:
            details = repos.bookings.get(booking_id)
            allowed = details and (user.is_admin or details.booking.user_id == user.id)
            receipt = repos.bookings.receipt(booking_id) if allowed else None
            require(receipt, NotFound("No tienes acceso a este comprobante."))
            return receipt

    def cancel(self, user: User, booking_id: int) -> BookingDetails:
        with self.uow() as repos:
            details = self._accessible(repos, user, booking_id)
            self._cancel(repos, details.booking, by_admin=user.is_admin)
            return repos.bookings.get(booking_id)

    # ---- admin use cases --------------------------------------------------------
    def approve(self, admin: User, booking_id: int) -> BookingDetails:
        with self.uow() as repos:
            details = self._in_review(repos, admin, booking_id)
            require(
                details.booking.start_at > self.clock.now(),
                InvalidInput("El horario de esta reserva ya pasó. Cancélala para liberar el registro."),
            )
            self._confirm(repos, details)
            return repos.bookings.get(booking_id)

    def reject(self, admin: User, booking_id: int) -> BookingDetails:
        with self.uow() as repos:
            details = self._in_review(repos, admin, booking_id)
            self._cancel(repos, details.booking, by_admin=True)
            return repos.bookings.get(booking_id)

    # ---- internals ----------------------------------------------------------------
    def _accessible(self, repos: Repositories, user: User, booking_id: int) -> BookingDetails:
        details = repos.bookings.get(booking_id, lock=True)
        require(
            details and (details.booking.user_id == user.id or user.is_admin),
            NotFound("No tienes acceso a esta reserva."),
        )
        return details

    def _owned_pending(self, repos: Repositories, user: User, booking_id: int) -> BookingDetails:
        details = self._accessible(repos, user, booking_id)
        require(
            details.booking.user_id == user.id,
            Forbidden("Solo el cliente de esta reserva puede completar el pago."),
        )
        require(details.booking.status == "pending", InvalidInput("La reserva ya no está pendiente de pago."))
        # Housekeeping may not have run yet: the deadline is enforced here, under the row lock.
        require(
            details.booking.expires_at > self.clock.now(),
            InvalidInput("El tiempo para pagar esta reserva venció. Elige el horario de nuevo."),
        )
        return details

    def _in_review(self, repos: Repositories, admin: User, booking_id: int) -> BookingDetails:
        require(admin.is_admin, Forbidden("Esta sección es exclusiva para administradores."))
        details = self._accessible(repos, admin, booking_id)
        require(
            details.booking.status == "review" and details.booking.payment.has_receipt,
            InvalidInput("La reserva no tiene un comprobante pendiente de revisión."),
        )
        return details

    def _confirm(self, repos: Repositories, details: BookingDetails) -> None:
        booking, court = details.booking, details.court
        booking.status, booking.payment.status = "confirmed", "paid"
        repos.bookings.save_status(booking)
        now, when = self.clock.now(), short_lima(booking.start_at)
        repos.notifications.add_once(self._message(
            booking, "confirmation", now,
            f"¡Tu reserva {booking.code} está confirmada! {court.name}, {when}. Total: S/ {booking.total:.2f}.",
        ))
        reminder_at = booking.start_at - CANCEL_NOTICE
        if reminder_at > now:
            repos.notifications.add_once(self._message(
                booking, "reminder", reminder_at,
                f"¡Hoy toca jugar! Te esperamos en {court.name}. Reserva {booking.code}, {when}.",
            ))

    def _cancel(self, repos: Repositories, booking: Booking, by_admin: bool) -> None:
        require(booking.is_active, InvalidInput("Esta reserva ya no se puede cancelar."))
        require(
            by_admin or booking.status == "pending" or booking.start_at >= self.clock.now() + CANCEL_NOTICE,
            InvalidInput(
                "Las reservas confirmadas o en revisión se cancelan con al menos 2 horas de "
                "anticipación. Contacta al administrador."
            ),
        )
        booking.status = "cancelled"
        booking.payment.status = "refunded" if booking.payment.status == "paid" else "rejected"
        repos.bookings.save_status(booking)
        repos.notifications.cancel_scheduled(booking.id)
        repos.notifications.add_once(self._message(
            booking, "cancellation", self.clock.now(),
            f"La reserva {booking.code} fue cancelada. El horario vuelve a estar disponible.",
        ))

    def _message(self, booking: Booking, kind: str, when, text: str) -> Notification:
        status = "scheduled" if when > self.clock.now() else "simulated"
        return Notification(
            id=None, booking_id=booking.id, kind=kind, text=text, channel="WhatsApp",
            scheduled_at=when, status=status,
        )
