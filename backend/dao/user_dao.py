from datetime import datetime

from sqlalchemy import delete, select

from backend.dao.base import BaseDAO
from backend.db.tables import sessions, users


class UserDAO(BaseDAO):
    table = users

    def find_by_email(self, email: str):
        return self.conn.execute(select(users).where(users.c.email == email)).mappings().first()

    def list_customers(self):
        query = select(users).where(users.c.is_admin.is_(False)).order_by(users.c.name)
        return self.conn.execute(query).mappings().all()


class SessionDAO(BaseDAO):
    table = sessions

    def find_user_id(self, token_hash: str, now: datetime) -> int | None:
        query = select(sessions.c.user_id).where(
            sessions.c.token_hash == token_hash, sessions.c.expires_at > now
        )
        return self.conn.execute(query).scalar_one_or_none()

    def delete(self, token_hash: str) -> None:
        self.conn.execute(delete(sessions).where(sessions.c.token_hash == token_hash))

    def delete_expired(self, now: datetime) -> None:
        self.conn.execute(delete(sessions).where(sessions.c.expires_at <= now))
