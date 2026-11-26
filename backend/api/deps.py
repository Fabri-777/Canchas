"""FastAPI dependencies: service lookup, current user and per-request housekeeping."""
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Request

from backend.config import Settings
from backend.core.clock import Clock
from backend.core.errors import Forbidden, NotAuthenticated
from backend.domain.models import User
from backend.services.admin_service import AdminService
from backend.services.auth_service import AuthService
from backend.services.booking_service import BookingService
from backend.services.court_service import CourtService
from backend.services.notification_service import NotificationService


@dataclass
class Services:
    auth: AuthService
    courts: CourtService
    bookings: BookingService
    notifications: NotificationService
    admin: AdminService
    clock: Clock


def get_services(request: Request) -> Services:
    return request.app.state.services


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


ServicesDep = Annotated[Services, Depends(get_services)]
SettingsDep = Annotated[Settings, Depends(get_settings)]


def session_token(request: Request, settings: SettingsDep) -> str | None:
    return request.cookies.get(settings.session_cookie)


def housekeeping(request: Request, services: ServicesDep) -> None:
    """Make sure the schema exists, then expire unpaid bookings / deliver due reminders."""
    request.app.state.ensure_database()
    services.bookings.process_due()


def optional_user(
    services: ServicesDep, token: Annotated[str | None, Depends(session_token)]
) -> User | None:
    return services.auth.current_user(token)


def current_user(user: Annotated[User | None, Depends(optional_user)]) -> User:
    if user is None:
        raise NotAuthenticated("Ingresa a tu cuenta para continuar.")
    return user


def current_admin(user: Annotated[User, Depends(current_user)]) -> User:
    if not user.is_admin:
        raise Forbidden("Esta sección es exclusiva para administradores.")
    return user


OptionalUser = Annotated[User | None, Depends(optional_user)]
CurrentUser = Annotated[User, Depends(current_user)]
CurrentAdmin = Annotated[User, Depends(current_admin)]
SessionToken = Annotated[str | None, Depends(session_token)]
