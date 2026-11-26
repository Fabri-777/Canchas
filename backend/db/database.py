"""Engine creation, schema bootstrap and the Unit of Work (one transaction per use case)."""
from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import Engine, create_engine, event, func, select
from sqlalchemy.pool import StaticPool

from backend.core.clock import Clock, to_db
from backend.db import tables
from backend.repositories import Repositories


def create_db_engine(url: str) -> Engine:
    if url.startswith("sqlite"):
        engine = create_engine(
            url, connect_args={"check_same_thread": False}, poolclass=StaticPool
        )

        @event.listens_for(engine, "connect")
        def _enable_foreign_keys(dbapi_connection, _record):
            dbapi_connection.execute("PRAGMA foreign_keys=ON")

        return engine
    # pool_pre_ping discards dead connections (MySQL restarts, wait_timeout) before use.
    return create_engine(url, pool_pre_ping=True, pool_recycle=1800, pool_size=5, max_overflow=10)


def init_schema(engine: Engine, clock: Clock) -> None:
    """Create missing tables and load sample data on an empty database (idempotent)."""
    tables.metadata.create_all(engine)
    with engine.begin() as conn:
        if conn.execute(select(func.count()).select_from(tables.users)).scalar_one():
            return
        now = to_db(clock.now())
        conn.execute(
            tables.users.insert(),
            [
                {"id": 1, "name": "Diego Ramírez", "email": "cliente@cancha.local",
                 "phone": "999000111", "is_admin": False, "created_at": now},
                {"id": 2, "name": "Valeria Torres", "email": "admin@cancha.local",
                 "phone": "999000111", "is_admin": True, "created_at": now},
            ],
        )
        base = {"opens_at": 8, "closes_at": 23, "active": True}
        conn.execute(
            tables.courts.insert(),
            [
                {**base, "name": "La Tribuna", "sport": "futbol", "price": 80, "capacity": 10,
                 "description": "Grass sintético · Fútbol 5 · Iluminación LED",
                 "district": "Santiago de Surco, Lima"},
                {**base, "name": "El Mirador", "sport": "futbol", "price": 120, "capacity": 14,
                 "description": "Grass sintético · Fútbol 7 · Iluminación LED",
                 "district": "San Borja, Lima"},
                {**base, "name": "La Central", "sport": "voley", "price": 50, "capacity": 12,
                 "description": "Losa deportiva · Vóley 6 · Iluminación LED",
                 "district": "Santiago de Surco, Lima"},
            ],
        )


class UnitOfWork:
    """Opens a transaction and hands the use case every repository bound to it.

    Commit happens when the block ends normally; any exception rolls everything back.
    """

    def __init__(self, engine: Engine):
        self.engine = engine

    @contextmanager
    def __call__(self) -> Iterator[Repositories]:
        with self.engine.begin() as conn:
            yield Repositories(conn)
