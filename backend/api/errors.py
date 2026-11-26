"""Translate every failure into a JSON body {"detail": "<message>"} with a fitting status."""
import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import DBAPIError, IntegrityError, OperationalError

from backend.core.errors import AppError

log = logging.getLogger("canchas")

DB_DOWN = "No pudimos conectar con la base de datos. Intenta nuevamente en unos segundos."


def _json(status: int, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"detail": message})


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error(_: Request, exc: AppError):
        return _json(exc.status_code, exc.message)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError):
        fields = sorted({str(err["loc"][-1]) for err in exc.errors() if err.get("loc")})
        suffix = f" ({', '.join(fields)})" if fields else ""
        return _json(422, f"Revisa los datos enviados{suffix}.")

    @app.exception_handler(IntegrityError)
    async def integrity_error(_: Request, exc: IntegrityError):
        log.warning("Integrity error: %s", exc.orig)
        return _json(409, "Este registro entra en conflicto con otro existente. Actualiza e intenta de nuevo.")

    @app.exception_handler(OperationalError)
    async def database_down(_: Request, exc: OperationalError):
        log.error("Database unavailable: %s", exc.orig)
        return _json(503, DB_DOWN)

    @app.exception_handler(DBAPIError)
    async def database_error(_: Request, exc: DBAPIError):
        log.exception("Database error", exc_info=exc)
        return _json(503 if exc.connection_invalidated else 500, DB_DOWN)

    @app.exception_handler(Exception)
    async def unexpected(_: Request, exc: Exception):
        log.exception("Unexpected error", exc_info=exc)
        return _json(500, "Ocurrió un error inesperado. Intenta nuevamente.")
