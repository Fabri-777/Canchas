"""Domain objects -> JSON shapes the frontend expects."""
from backend.core.clock import iso
from backend.domain.models import (
    BOOKING_STATUS,
    PAYMENT_METHODS,
    PAYMENT_STATUS,
    Block,
    BookingDetails,
    Court,
    Notification,
    User,
)


def user_json(user: User | None) -> dict | None:
    if user is None:
        return None
    return {"id": user.id, "name": user.name, "email": user.email, "phone": user.phone,
            "is_admin": user.is_admin}


def court_json(court: Court) -> dict:
    return {
        "id": court.id, "name": court.name, "sport": court.sport, "sport_label": court.sport_label,
        "description": court.description, "district": court.district, "price": float(court.price),
        "capacity": court.capacity, "opens_at": court.opens_at, "closes_at": court.closes_at,
        "active": court.active,
    }


def booking_json(details: BookingDetails) -> dict:
    booking, payment = details.booking, details.booking.payment
    return {
        "id": booking.id, "code": booking.code, "user_id": booking.user_id,
        "court_id": booking.court_id, "start": iso(booking.start_at), "end": iso(booking.end_at),
        "expires_at": iso(booking.expires_at), "total": float(booking.total),
        "status": booking.status, "status_label": BOOKING_STATUS[booking.status],
        "court": court_json(details.court), "customer": details.customer,
        "payment": {
            "method": payment.method, "method_label": PAYMENT_METHODS[payment.method],
            "status": payment.status, "status_label": PAYMENT_STATUS[payment.status],
            "has_receipt": payment.has_receipt,
        },
    }


def notification_json(n: Notification) -> dict:
    return {"id": n.id, "booking_id": n.booking_id, "kind": n.kind, "text": n.text,
            "channel": n.channel, "scheduled_at": iso(n.scheduled_at), "status": n.status,
            "code": n.booking_code, "customer": n.customer}


def block_json(block: Block) -> dict:
    return {"id": block.id, "court_id": block.court_id, "start": iso(block.start_at),
            "reason": block.reason, "court": block.court_name}
