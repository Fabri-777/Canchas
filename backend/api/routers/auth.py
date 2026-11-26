from fastapi import APIRouter, Response

from backend.api.deps import CurrentUser, OptionalUser, ServicesDep, SessionToken, SettingsDep
from backend.api.presenters import user_json
from backend.api.schemas import DemoLoginIn, LoginIn, ProfileIn, RegisterIn
from backend.config import Settings
from backend.core.clock import today_in_lima
from backend.domain.models import User

router = APIRouter(tags=["auth"])


def _signed_in(response: Response, settings: Settings, user: User, token: str) -> dict:
    response.set_cookie(
        settings.session_cookie, token, max_age=settings.session_hours * 3600,
        httponly=True, samesite="lax", secure=settings.secure_cookies, path="/",
    )
    return {"user": user_json(user)}


@router.get("/session/")
def session(user: OptionalUser, services: ServicesDep, settings: SettingsDep):
    today = today_in_lima(services.clock.now()).isoformat()
    return {"user": user_json(user), "demo": settings.demo_mode, "today": today}


@router.post("/auth/register/")
def register(body: RegisterIn, response: Response, services: ServicesDep, settings: SettingsDep):
    user, token = services.auth.register(body.name, body.email, body.phone, body.password)
    return _signed_in(response, settings, user, token)


@router.post("/auth/login/")
def login(body: LoginIn, response: Response, services: ServicesDep, settings: SettingsDep):
    services.auth.purge_expired_sessions()
    user, token = services.auth.login(body.email, body.password)
    return _signed_in(response, settings, user, token)


@router.post("/auth/demo/")
def demo_login(body: DemoLoginIn, response: Response, services: ServicesDep, settings: SettingsDep):
    user, token = services.auth.demo_login(body.role)
    return _signed_in(response, settings, user, token)


@router.post("/auth/logout/")
def logout(response: Response, token: SessionToken, services: ServicesDep, settings: SettingsDep):
    services.auth.logout(token)
    response.delete_cookie(settings.session_cookie, path="/")
    return {"user": None}


@router.post("/profile/")
def update_profile(body: ProfileIn, user: CurrentUser, services: ServicesDep):
    return {"user": user_json(services.auth.update_profile(user, body.name, body.phone))}
