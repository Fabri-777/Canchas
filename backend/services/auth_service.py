from datetime import timedelta

from backend.core.clock import Clock
from backend.core.errors import Conflict, Forbidden, InvalidInput, NotAuthenticated, require
from backend.core.security import hash_password, hash_token, new_session_token, verify_password
from backend.db.database import UnitOfWork
from backend.domain.models import User
from backend.services.validators import check_password, clean_email, clean_name_phone

DEMO_EMAILS = {"client": "cliente@cancha.local", "admin": "admin@cancha.local"}


class AuthService:
    def __init__(self, uow: UnitOfWork, clock: Clock, session_hours: int, demo_mode: bool):
        self.uow = uow
        self.clock = clock
        self.session_ttl = timedelta(hours=session_hours)
        self.demo_mode = demo_mode

    def current_user(self, token: str | None) -> User | None:
        if not token:
            return None
        with self.uow() as repos:
            return repos.users.by_session(hash_token(token), self.clock.now())

    def register(self, name: str, email: str, phone: str, password: str) -> tuple[User, str]:
        name, phone = clean_name_phone(name, phone)
        email = clean_email(email)
        check_password(password)
        with self.uow() as repos:
            require(not repos.users.by_email(email), Conflict("Ya existe una cuenta con este correo."))
            password_hash, salt = hash_password(password)
            user = repos.users.add(name, email, phone, password_hash, salt, self.clock.now())
            return user, self._open_session(repos, user)

    def login(self, email: str, password: str) -> tuple[User, str]:
        with self.uow() as repos:
            user = repos.users.by_email((email or "").strip().lower())
            require(
                user and verify_password(password or "", user.password_hash, user.password_salt),
                NotAuthenticated(
                    "El correo o la contraseña no son correctos. "
                    "Para las cuentas de ejemplo usa los botones de demostración."
                ),
            )
            return user, self._open_session(repos, user)

    def demo_login(self, role: str) -> tuple[User, str]:
        require(self.demo_mode, Forbidden("El acceso de demostración está desactivado."))
        require(role in DEMO_EMAILS, InvalidInput("Rol de demostración inválido."))
        with self.uow() as repos:
            user = repos.users.by_email(DEMO_EMAILS[role])
            require(user, InvalidInput("La cuenta de demostración no existe."))
            return user, self._open_session(repos, user)

    def logout(self, token: str | None) -> None:
        if token:
            with self.uow() as repos:
                repos.users.close_session(hash_token(token))

    def update_profile(self, user: User, name: str, phone: str) -> User:
        name, phone = clean_name_phone(name, phone)
        with self.uow() as repos:
            return repos.users.update_profile(user.id, name, phone)

    def purge_expired_sessions(self) -> None:
        """Own short transaction, never mixed with a sign-in (avoids InnoDB gap-lock deadlocks)."""
        with self.uow() as repos:
            repos.users.purge_sessions(self.clock.now())

    def _open_session(self, repos, user: User) -> str:
        token = new_session_token()
        repos.users.open_session(user.id, hash_token(token), self.clock.now() + self.session_ttl)
        return token
