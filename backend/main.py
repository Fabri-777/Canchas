"""Composition root: builds the layers and wires them together.

Request flow:  browser -> FastAPI router -> service -> repository -> DAO -> MySQL
Run:           uvicorn backend.main:app --reload
"""
import logging
import threading

from fastapi import APIRouter, Depends, FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import Engine, text

from backend.api.deps import Services, housekeeping
from backend.api.errors import DB_DOWN, register_error_handlers
from backend.api.routers import admin, auth, bookings, courts
from backend.config import Settings
from backend.core.clock import Clock
from backend.core.errors import ServiceUnavailable
from backend.db.database import UnitOfWork, create_db_engine, init_schema
from backend.services.admin_service import AdminService
from backend.services.auth_service import AuthService
from backend.services.booking_service import BookingService
from backend.services.court_service import CourtService
from backend.services.notification_service import NotificationService

log = logging.getLogger("canchas")

MAX_BODY_BYTES = 6 * 1024 * 1024  # 5 MB receipt + multipart overhead


def build_services(engine: Engine, clock: Clock, settings: Settings) -> Services:
    uow = UnitOfWork(engine)
    return Services(
        auth=AuthService(uow, clock, settings.session_hours, settings.demo_mode),
        courts=CourtService(uow, clock),
        bookings=BookingService(uow, clock),
        notifications=NotificationService(uow),
        admin=AdminService(uow, clock),
        clock=clock,
    )


class DatabaseBootstrap:
    """Creates the schema lazily, so the app starts even if MySQL is down and recovers later."""

    def __init__(self, engine: Engine, clock: Clock):
        self.engine, self.clock = engine, clock
        self.ready = False
        self._lock = threading.Lock()

    def __call__(self) -> None:
        if self.ready:
            return
        with self._lock:
            if self.ready:
                return
            try:
                init_schema(self.engine, self.clock)
            except Exception as exc:  # noqa: BLE001 - any DB failure means "not ready yet"
                log.error("Database not ready: %s", exc)
                raise ServiceUnavailable(DB_DOWN) from exc
            self.ready = True


def create_app(settings: Settings | None = None, engine: Engine | None = None, clock: Clock | None = None) -> FastAPI:
    settings = settings or Settings()
    engine = engine or create_db_engine(settings.database_url)
    clock = clock or Clock()

    app = FastAPI(title="Cancha API", version="2.0.0")
    app.state.settings = settings
    app.state.engine = engine
    app.state.services = build_services(engine, clock, settings)
    app.state.ensure_database = DatabaseBootstrap(engine, clock)
    register_error_handlers(app)

    @app.middleware("http")
    async def limit_body_size(request, call_next):
        """Reject oversized bodies by Content-Length before multipart parsing spools them."""
        length = request.headers.get("content-length", "")
        if length.isdigit() and int(length) > MAX_BODY_BYTES:
            return JSONResponse(status_code=413, content={"detail": "El archivo supera el tamaño permitido (5 MB)."})
        return await call_next(request)

    api = APIRouter(prefix="/api", dependencies=[Depends(housekeeping)])
    for module in (auth, courts, bookings, admin):
        api.include_router(module.router)
    app.include_router(api)

    @app.get("/api/health", tags=["health"])
    def health():
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
        except Exception:  # noqa: BLE001
            return JSONResponse(status_code=503, content={"status": "degraded", "database": False})
        return {"status": "ok", "database": True}

    frontend = settings.frontend_dir
    app.mount("/static", StaticFiles(directory=frontend / "static"), name="static")

    @app.get("/", include_in_schema=False)
    def index():
        return FileResponse(frontend / "index.html", headers={"Cache-Control": "no-cache"})

    return app


app = create_app()
