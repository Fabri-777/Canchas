from datetime import datetime

from sqlalchemy import delete, exists, select

from backend.dao.base import BaseDAO
from backend.db.tables import blocks, courts


class BlockDAO(BaseDAO):
    table = blocks

    def exists_at(self, court_id: int, start_at: datetime) -> bool:
        query = select(exists().where(blocks.c.court_id == court_id, blocks.c.start_at == start_at))
        return bool(self.conn.execute(query).scalar())

    def starts_between(self, court_id: int, start: datetime, end: datetime):
        query = select(blocks.c.start_at).where(
            blocks.c.court_id == court_id, blocks.c.start_at >= start, blocks.c.start_at < end
        )
        return set(self.conn.execute(query).scalars().all())

    def list_upcoming(self, now: datetime):
        query = (
            select(blocks, courts.c.name.label("court_name"))
            .join(courts, courts.c.id == blocks.c.court_id)
            .where(blocks.c.start_at > now)
            .order_by(blocks.c.start_at)
        )
        return self.conn.execute(query).mappings().all()

    def delete(self, block_id: int) -> int:
        return self.conn.execute(delete(blocks).where(blocks.c.id == block_id)).rowcount
