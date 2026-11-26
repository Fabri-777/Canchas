from datetime import datetime

from sqlalchemy import Connection

from backend.core.clock import from_db, to_db
from backend.dao.block_dao import BlockDAO
from backend.domain.models import Block


class BlockRepository:
    def __init__(self, conn: Connection):
        self.dao = BlockDAO(conn)

    def add(self, block: Block) -> Block:
        block.id = self.dao.insert(
            court_id=block.court_id, start_at=to_db(block.start_at), reason=block.reason
        )
        return block

    def remove(self, block_id: int) -> bool:
        return self.dao.delete(block_id) > 0

    def exists_at(self, court_id: int, start_at: datetime) -> bool:
        return self.dao.exists_at(court_id, to_db(start_at))

    def starts_between(self, court_id: int, start: datetime, end: datetime) -> set[datetime]:
        return {from_db(v) for v in self.dao.starts_between(court_id, to_db(start), to_db(end))}

    def upcoming(self, now: datetime) -> list[Block]:
        return [
            Block(id=row["id"], court_id=row["court_id"], start_at=from_db(row["start_at"]),
                  reason=row["reason"], court_name=row["court_name"])
            for row in self.dao.list_upcoming(to_db(now))
        ]
