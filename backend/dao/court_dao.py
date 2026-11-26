from sqlalchemy import select

from backend.dao.base import BaseDAO
from backend.db.tables import courts


class CourtDAO(BaseDAO):
    table = courts

    def list(self, only_active: bool = False):
        query = select(courts).order_by(courts.c.id)
        if only_active:
            query = query.where(courts.c.active.is_(True))
        return self.conn.execute(query).mappings().all()
