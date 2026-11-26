from datetime import datetime

from sqlalchemy import Connection

from backend.core.clock import to_db
from backend.dao.user_dao import SessionDAO, UserDAO
from backend.domain.models import User


def _to_user(row) -> User | None:
    if row is None:
        return None
    return User(
        id=row["id"], name=row["name"], email=row["email"], phone=row["phone"],
        is_admin=bool(row["is_admin"]), password_hash=row["password_hash"],
        password_salt=row["password_salt"],
    )


class UserRepository:
    def __init__(self, conn: Connection):
        self.users = UserDAO(conn)
        self.sessions = SessionDAO(conn)

    def get(self, user_id: int) -> User | None:
        return _to_user(self.users.find_by_id(user_id))

    def by_email(self, email: str) -> User | None:
        return _to_user(self.users.find_by_email(email))

    def add(self, name: str, email: str, phone: str, password_hash: str, salt: str, now: datetime) -> User:
        user_id = self.users.insert(
            name=name, email=email, phone=phone, is_admin=False,
            password_hash=password_hash, password_salt=salt, created_at=to_db(now),
        )
        return self.get(user_id)

    def update_profile(self, user_id: int, name: str, phone: str) -> User:
        self.users.update(user_id, name=name, phone=phone)
        return self.get(user_id)

    def customers(self) -> list[User]:
        return [_to_user(row) for row in self.users.list_customers()]

    # Sessions belong to the user aggregate: they only exist to identify a user.
    def open_session(self, user_id: int, token_hash: str, expires_at: datetime) -> None:
        self.sessions.insert(token_hash=token_hash, user_id=user_id, expires_at=to_db(expires_at))

    def by_session(self, token_hash: str, now: datetime) -> User | None:
        user_id = self.sessions.find_user_id(token_hash, to_db(now))
        return self.get(user_id) if user_id is not None else None

    def close_session(self, token_hash: str) -> None:
        self.sessions.delete(token_hash)

    def purge_sessions(self, now: datetime) -> None:
        self.sessions.delete_expired(to_db(now))
