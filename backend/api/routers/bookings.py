import base64

from fastapi import APIRouter, File, UploadFile
from starlette.concurrency import run_in_threadpool

from backend.api.deps import CurrentAdmin, CurrentUser, ServicesDep
from backend.api.presenters import booking_json, notification_json
from backend.api.schemas import BookingIn, PayIn
from backend.core.errors import InvalidInput
from backend.services.validators import MAX_RECEIPT_BYTES

router = APIRouter(tags=["bookings"])


@router.get("/bookings/")
def my_bookings(user: CurrentUser, services: ServicesDep):
    return {"bookings": [booking_json(b) for b in services.bookings.list_for(user)]}


@router.post("/bookings/", status_code=201)
def create_booking(body: BookingIn, user: CurrentUser, services: ServicesDep):
    details = services.bookings.create(user, body.court_id, body.date, body.hour, body.method)
    return {"booking": booking_json(details)}


@router.post("/bookings/{booking_id}/pay/")
def pay(booking_id: int, body: PayIn, user: CurrentUser, services: ServicesDep):
    return {"booking": booking_json(services.bookings.pay(user, booking_id, body.result))}


@router.post("/bookings/{booking_id}/upload/")
async def upload_receipt(
    booking_id: int, user: CurrentUser, services: ServicesDep, receipt: UploadFile = File(...)
):
    # Read one byte past the limit so oversized files are rejected without loading them whole.
    content = await receipt.read(MAX_RECEIPT_BYTES + 1)
    if len(content) > MAX_RECEIPT_BYTES:
        raise InvalidInput("Adjunta una imagen de hasta 5 MB.")
    # The use case does blocking DB I/O: run it in the thread pool, off the event loop.
    details = await run_in_threadpool(services.bookings.upload_receipt, user, booking_id, content)
    return {"booking": booking_json(details)}


@router.post("/bookings/{booking_id}/cancel/")
def cancel(booking_id: int, user: CurrentUser, services: ServicesDep):
    return {"booking": booking_json(services.bookings.cancel(user, booking_id))}


@router.post("/bookings/{booking_id}/approve/")
def approve(booking_id: int, admin: CurrentAdmin, services: ServicesDep):
    return {"booking": booking_json(services.bookings.approve(admin, booking_id))}


@router.post("/bookings/{booking_id}/reject/")
def reject(booking_id: int, admin: CurrentAdmin, services: ServicesDep):
    return {"booking": booking_json(services.bookings.reject(admin, booking_id))}


@router.get("/receipts/{booking_id}/")
def receipt(booking_id: int, user: CurrentUser, services: ServicesDep):
    content, mime = services.bookings.receipt(user, booking_id)
    return {"receipt": f"data:{mime};base64,{base64.b64encode(content).decode()}"}


@router.get("/notifications/")
def notifications(user: CurrentUser, services: ServicesDep):
    return {"notifications": [notification_json(n) for n in services.notifications.list_for(user)]}
