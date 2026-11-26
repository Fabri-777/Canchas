"""Test suite for the Cancha API.

Run:  python -m pytest test.py -v

Every test gets a fresh in-memory SQLite database (same tables, same DAOs as MySQL)
and a controllable clock, so results never depend on the real date or on a running MySQL.
"""
import io
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import create_engine

from backend.config import Settings
from backend.core.clock import Clock
from backend.core.errors import InvalidInput
from backend.dao.booking_dao import BookingDAO
from backend.db.database import UnitOfWork, create_db_engine, init_schema
from backend.main import create_app
from backend.services.booking_service import BookingService

# 2026-12-01 12:00 in Lima (UTC-5).
START = datetime(2026, 12, 1, 17, 0, tzinfo=UTC)
TOMORROW = "2026-12-02"


def make_image(fmt: str) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (40, 30), (195, 239, 103)).save(buffer, format=fmt)
    return buffer.getvalue()


PNG = make_image("PNG")
JPG = make_image("JPEG")


class FakeClock(Clock):
    def __init__(self, now: datetime):
        self.current = now

    def now(self) -> datetime:
        return self.current

    def advance(self, **delta) -> None:
        self.current += timedelta(**delta)


# ---------------------------------------------------------------- fixtures
@pytest.fixture
def clock():
    return FakeClock(START)


@pytest.fixture
def engine():
    engine = create_db_engine("sqlite://")
    yield engine
    engine.dispose()


@pytest.fixture
def app(engine, clock):
    return create_app(Settings(database_url="sqlite://", demo_mode=True), engine=engine, clock=clock)


@pytest.fixture
def client(app):
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def admin(app):
    with TestClient(app) as admin_client:
        assert admin_client.post("/api/auth/demo/", json={"role": "admin"}).status_code == 200
        yield admin_client


def login_client(client: TestClient) -> dict:
    response = client.post("/api/auth/demo/", json={"role": "client"})
    assert response.status_code == 200
    return response.json()["user"]


def register(client: TestClient, email="ana@correo.com") -> dict:
    response = client.post("/api/auth/register/", json={
        "name": "Ana Torres", "email": email, "phone": "987654321", "password": "partido2026",
    })
    assert response.status_code == 200, response.text
    return response.json()["user"]


def book(client: TestClient, hour=18, method="visa", court_id=1, day=TOMORROW):
    return client.post("/api/bookings/", json={
        "court_id": court_id, "date": day, "hour": hour, "method": method,
    })


def slot_state(client: TestClient, hour: int, court_id=1, day=TOMORROW) -> str:
    slots = client.get(f"/api/availability/?court={court_id}&date={day}").json()["slots"]
    return next(slot["state"] for slot in slots if slot["hour"] == hour)


# ---------------------------------------------------------------- infrastructure
def test_health_reports_database_ok(client):
    assert client.get("/api/health").json() == {"status": "ok", "database": True}


def test_frontend_is_served(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]


def test_database_down_returns_json_503(clock):
    # Port 1 refuses connections immediately: simulates MySQL being unavailable.
    dead = create_engine("mysql+pymysql://user:pass@127.0.0.1:1/canchas", connect_args={"connect_timeout": 1})
    app = create_app(Settings(database_url="unused"), engine=dead, clock=clock)
    with TestClient(app) as client:
        response = client.get("/api/courts/")
        assert response.status_code == 503
        assert "base de datos" in response.json()["detail"]
        assert client.get("/api/health").status_code == 503


def test_validation_errors_are_json_in_spanish(client):
    login_client(client)
    response = client.post("/api/bookings/", json={"court_id": "abc"})
    assert response.status_code == 422
    assert response.json()["detail"].startswith("Revisa los datos enviados")


def test_schema_bootstrap_is_idempotent(engine, clock):
    init_schema(engine, clock)
    init_schema(engine, clock)
    with engine.connect() as conn:
        assert len(conn.exec_driver_sql("SELECT id FROM courts").all()) == 3


# ---------------------------------------------------------------- auth
def test_anonymous_session(client):
    body = client.get("/api/session/").json()
    assert body == {"user": None, "demo": True, "today": "2026-12-01"}


def test_register_login_logout_and_profile(client):
    user = register(client)
    assert user["email"] == "ana@correo.com" and not user["is_admin"]
    assert client.get("/api/session/").json()["user"]["id"] == user["id"]

    updated = client.post("/api/profile/", json={"name": "Ana T.", "phone": "912345678"})
    assert updated.json()["user"]["name"] == "Ana T."

    client.post("/api/auth/logout/", json={})
    assert client.get("/api/session/").json()["user"] is None

    ok = client.post("/api/auth/login/", json={"email": "ANA@correo.com ", "password": "partido2026"})
    assert ok.status_code == 200
    bad = client.post("/api/auth/login/", json={"email": "ana@correo.com", "password": "otra-cosa"})
    assert bad.status_code == 401


def test_register_rejects_duplicates_and_weak_passwords(client):
    register(client)
    duplicate = client.post("/api/auth/register/", json={
        "name": "Otra", "email": "ana@correo.com", "phone": "987654321", "password": "partido2026",
    })
    assert duplicate.status_code == 409
    weak = client.post("/api/auth/register/", json={
        "name": "Luis", "email": "luis@correo.com", "phone": "987654321", "password": "12345678",
    })
    assert weak.status_code == 400
    bad_phone = client.post("/api/auth/register/", json={
        "name": "Luis", "email": "luis@correo.com", "phone": "812345678", "password": "partido2026",
    })
    assert bad_phone.status_code == 400


def test_session_cookie_is_http_only(client):
    response = client.post("/api/auth/demo/", json={"role": "client"})
    assert "httponly" in response.headers["set-cookie"].lower()


def test_protected_routes_require_login_and_admin_role(client):
    assert client.get("/api/bookings/").status_code == 401
    assert client.get("/api/notifications/").status_code == 401
    login_client(client)
    assert client.get("/api/admin/overview/").status_code == 403


# ---------------------------------------------------------------- courts & availability
def test_list_active_courts(client):
    courts = client.get("/api/courts/").json()["courts"]
    assert [c["name"] for c in courts] == ["La Tribuna", "El Mirador", "La Central"]
    assert courts[0]["sport_label"] == "Fútbol" and courts[0]["price"] == 80.0


def test_availability_marks_past_hours(client):
    slots = client.get("/api/availability/?court=1&date=2026-12-01").json()["slots"]
    states = {s["hour"]: s["state"] for s in slots}
    assert states[8] == "past" and states[12] == "past" and states[13] == "available"
    assert len(slots) == 15  # 08:00 .. 22:00


def test_availability_rejects_invalid_date(client):
    assert client.get("/api/availability/?court=1&date=2026-13-45").status_code == 400
    assert client.get("/api/availability/?court=99&date=2026-12-02").status_code == 404


# ---------------------------------------------------------------- bookings
def test_card_booking_flow(client):
    login_client(client)
    created = book(client)
    assert created.status_code == 201
    booking = created.json()["booking"]
    assert booking["status"] == "pending" and booking["code"] == "CN-00001"
    assert booking["start"] == "2026-12-02T23:00:00.000Z"
    assert booking["expires_at"] == "2026-12-01T17:15:00.000Z"
    assert slot_state(client, 18) == "booked"

    paid = client.post(f"/api/bookings/{booking['id']}/pay/", json={"result": "approved"}).json()["booking"]
    assert paid["status"] == "confirmed" and paid["payment"]["status"] == "paid"

    kinds = {n["kind"]: n["status"] for n in client.get("/api/notifications/").json()["notifications"]}
    assert kinds == {"confirmation": "simulated", "reminder": "scheduled"}
    assert [b["id"] for b in client.get("/api/bookings/").json()["bookings"]] == [booking["id"]]


def test_double_booking_is_rejected(app, client):
    login_client(client)
    assert book(client).status_code == 201
    with TestClient(app) as other:
        register(other, "otro@correo.com")
        response = book(other)
        assert response.status_code == 409
        assert "ya tiene una reserva" in response.json()["detail"]


def test_rejected_payment_keeps_booking_pending(client):
    login_client(client)
    booking_id = book(client).json()["booking"]["id"]
    result = client.post(f"/api/bookings/{booking_id}/pay/", json={"result": "rejected"}).json()["booking"]
    assert result["status"] == "pending" and result["payment"]["status"] == "rejected"


def test_pending_booking_expires_and_frees_the_slot(client, clock):
    login_client(client)
    booking_id = book(client).json()["booking"]["id"]
    clock.advance(minutes=16)
    assert client.get("/api/bookings/").json()["bookings"][0]["status"] == "expired"
    assert slot_state(client, 18) == "available"
    late = client.post(f"/api/bookings/{booking_id}/pay/", json={"result": "approved"})
    assert late.status_code == 400


@pytest.mark.parametrize("day,hour", [("2026-11-30", 18), ("2026-12-02", 6), ("2027-03-01", 18)])
def test_booking_outside_allowed_window_is_rejected(client, day, hour):
    login_client(client)
    assert book(client, hour=hour, day=day).status_code == 400


def test_invalid_payment_method(client):
    login_client(client)
    assert book(client, method="bitcoin").status_code == 400


def test_transfer_receipt_review_and_approval(client, admin):
    login_client(client)
    booking_id = book(client, method="transfer").json()["booking"]["id"]

    not_image = client.post(f"/api/bookings/{booking_id}/upload/",
                            files={"receipt": ("x.png", b"not an image", "image/png")})
    assert not_image.status_code == 400

    uploaded = client.post(f"/api/bookings/{booking_id}/upload/",
                           files={"receipt": ("comprobante.png", PNG, "image/png")})
    assert uploaded.json()["booking"]["status"] == "review"
    assert uploaded.json()["booking"]["payment"]["has_receipt"] is True

    receipt = admin.get(f"/api/receipts/{booking_id}/").json()["receipt"]
    assert receipt.startswith("data:image/png;base64,")

    approved = admin.post(f"/api/bookings/{booking_id}/approve/").json()["booking"]
    assert approved["status"] == "confirmed"
    overview = admin.get("/api/admin/overview/").json()
    assert overview["stats"]["income"] == 80.0 and overview["stats"]["review"] == 0


def test_receipt_is_private_to_owner_and_admin(app, client):
    login_client(client)
    booking_id = book(client, method="transfer").json()["booking"]["id"]
    client.post(f"/api/bookings/{booking_id}/upload/", files={"receipt": ("c.jpg", JPG, "image/jpeg")})
    with TestClient(app) as stranger:
        register(stranger, "extra@correo.com")
        assert stranger.get(f"/api/receipts/{booking_id}/").status_code == 404
        assert stranger.post(f"/api/bookings/{booking_id}/cancel/").status_code == 404


def test_oversized_receipt_is_rejected(client):
    login_client(client)
    booking_id = book(client, method="transfer").json()["booking"]["id"]
    big = PNG + b"\x00" * (5 * 1024 * 1024)
    response = client.post(f"/api/bookings/{booking_id}/upload/", files={"receipt": ("big.png", big, "image/png")})
    assert response.status_code == 400


def test_truncated_image_with_valid_signature_is_rejected(client):
    login_client(client)
    booking_id = book(client, method="transfer").json()["booking"]["id"]
    truncated = PNG[: len(PNG) // 2]
    response = client.post(f"/api/bookings/{booking_id}/upload/",
                           files={"receipt": ("c.png", truncated, "image/png")})
    assert response.status_code == 400
    assert client.get("/api/bookings/").json()["bookings"][0]["status"] == "pending"


def test_request_body_over_limit_is_rejected_before_parsing(client):
    login_client(client)
    booking_id = book(client, method="transfer").json()["booking"]["id"]
    huge = bytes(7 * 1024 * 1024)
    response = client.post(f"/api/bookings/{booking_id}/upload/", files={"receipt": ("x.png", huge, "image/png")})
    assert response.status_code == 413


def test_admin_reject_cancels_and_frees_slot(client, admin):
    login_client(client)
    booking_id = book(client, method="transfer").json()["booking"]["id"]
    client.post(f"/api/bookings/{booking_id}/upload/", files={"receipt": ("c.png", PNG, "image/png")})
    rejected = admin.post(f"/api/bookings/{booking_id}/reject/").json()["booking"]
    assert rejected["status"] == "cancelled" and rejected["payment"]["status"] == "rejected"
    assert slot_state(client, 18) == "available"


def test_cancellation_rules(client, admin, clock):
    login_client(client)
    booking_id = book(client, hour=15, day="2026-12-01").json()["booking"]["id"]  # starts in 3h
    client.post(f"/api/bookings/{booking_id}/pay/", json={"result": "approved"})

    clock.advance(hours=2)  # 1h before kickoff: customer can no longer cancel
    too_late = client.post(f"/api/bookings/{booking_id}/cancel/")
    assert too_late.status_code == 400

    cancelled = admin.post(f"/api/bookings/{booking_id}/cancel/").json()["booking"]
    assert cancelled["status"] == "cancelled" and cancelled["payment"]["status"] == "refunded"
    kinds = {n["kind"]: n["status"] for n in client.get("/api/notifications/").json()["notifications"]}
    assert kinds["cancellation"] == "simulated"


def test_customer_can_cancel_exactly_two_hours_before(client, clock):
    login_client(client)
    booking_id = book(client, hour=16, day="2026-12-01").json()["booking"]["id"]  # starts in 4h
    client.post(f"/api/bookings/{booking_id}/pay/", json={"result": "approved"})
    clock.advance(hours=2)  # exactly 2h before kickoff
    assert client.post(f"/api/bookings/{booking_id}/cancel/").status_code == 200


def test_payment_after_deadline_is_rejected_even_without_housekeeping(engine, clock):
    """The service enforces expiry itself; it does not rely on the per-request sweep."""
    init_schema(engine, clock)
    service = BookingService(UnitOfWork(engine), clock)
    with UnitOfWork(engine)() as repos:
        user = repos.users.get(1)
    booking_id = service.create(user, 1, TOMORROW, 18, "visa").booking.id
    clock.advance(minutes=15)
    with pytest.raises(InvalidInput):
        service.pay(user, booking_id, "approved")


def test_demo_login_is_disabled_by_default(engine, clock):
    app = create_app(Settings(database_url="sqlite://", demo_mode=False), engine=engine, clock=clock)
    with TestClient(app) as client:
        assert client.get("/api/session/").json()["demo"] is False
        assert client.post("/api/auth/demo/", json={"role": "admin"}).status_code == 403


def test_early_cancellation_cancels_pending_reminder(client):
    login_client(client)
    booking_id = book(client).json()["booking"]["id"]
    client.post(f"/api/bookings/{booking_id}/pay/", json={"result": "approved"})
    assert client.post(f"/api/bookings/{booking_id}/cancel/").status_code == 200
    kinds = {n["kind"]: n["status"] for n in client.get("/api/notifications/").json()["notifications"]}
    assert kinds == {"confirmation": "simulated", "reminder": "cancelled", "cancellation": "simulated"}


def test_reminder_is_delivered_when_due(client, clock):
    login_client(client)
    booking_id = book(client).json()["booking"]["id"]
    client.post(f"/api/bookings/{booking_id}/pay/", json={"result": "approved"})
    clock.advance(hours=27)  # 2026-12-02 15:00 Lima: kickoff at 18:00, reminder due at 16:00
    login_client(client)  # the 12h session expired meanwhile
    assert next(n for n in client.get("/api/notifications/").json()["notifications"]
                if n["kind"] == "reminder")["status"] == "scheduled"
    clock.advance(hours=1)
    reminder = next(n for n in client.get("/api/notifications/").json()["notifications"] if n["kind"] == "reminder")
    assert reminder["status"] == "simulated"


# ---------------------------------------------------------------- admin
def test_admin_creates_and_edits_courts(admin, client):
    court = {"name": "La Bombonera", "sport": "basket", "description": "Losa · Básquet 5",
             "district": "Miraflores, Lima", "price": "65.50", "capacity": "10",
             "opens_at": "9", "closes_at": "22", "active": True}
    created = admin.post("/api/admin/courts/", json=court).json()["court"]
    assert created["id"] == 4 and created["price"] == 65.5

    admin.post("/api/admin/courts/", json={**court, "id": created["id"], "active": False})
    assert "La Bombonera" not in [c["name"] for c in client.get("/api/courts/").json()["courts"]]

    invalid = admin.post("/api/admin/courts/", json={**court, "opens_at": 23, "closes_at": 8})
    assert invalid.status_code == 400
    missing = admin.post("/api/admin/courts/", json={**court, "id": 999})
    assert missing.status_code == 404


def test_admin_blocks_slot(admin, client):
    created = admin.post("/api/admin/blocks/", json={
        "court_id": "1", "date": TOMORROW, "hour": "18", "reason": "Mantenimiento del grass",
    })
    assert created.status_code == 201
    assert slot_state(client, 18) == "blocked"

    login_client(client)
    assert book(client).status_code == 409

    block_id = admin.get("/api/admin/overview/").json()["blocks"][0]["id"]
    assert admin.request("DELETE", "/api/admin/blocks/", json={"id": block_id}).status_code == 200
    assert slot_state(client, 18) == "available"
    assert admin.request("DELETE", "/api/admin/blocks/", json={"id": block_id}).status_code == 404


def test_admin_overview_lists_customers_only(admin):
    users = admin.get("/api/admin/overview/").json()["users"]
    assert [u["email"] for u in users] == ["cliente@cancha.local"]


# ---------------------------------------------------------------- layers in isolation
def test_dao_detects_taken_slot(engine, clock):
    init_schema(engine, clock)
    service = BookingService(UnitOfWork(engine), clock)
    with UnitOfWork(engine)() as repos:
        user = repos.users.get(1)
    details = service.create(user, 1, TOMORROW, 18, "visa")
    with engine.connect() as conn:
        dao = BookingDAO(conn)
        start = details.booking.start_at.replace(tzinfo=None)
        assert dao.slot_taken(1, start, ("pending",)) is True
        assert dao.slot_taken(2, start, ("pending",)) is False


def test_unit_of_work_rolls_back_on_error(engine, clock):
    init_schema(engine, clock)
    uow = UnitOfWork(engine)
    with pytest.raises(RuntimeError):
        with uow() as repos:
            repos.users.update_profile(1, "Nombre Temporal", "911111111")
            raise RuntimeError("boom")
    with uow() as repos:
        assert repos.users.get(1).name == "Diego Ramírez"
