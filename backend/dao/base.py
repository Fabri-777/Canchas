"""Base DAO: a Data Access Object owns the SQL of exactly one table."""
from typing import Any

from sqlalchemy import Connection, Table, insert, select, update


class BaseDAO:
    table: Table

    def __init__(self, conn: Connection):
        self.conn = conn

    def _pk(self):
        return list(self.table.primary_key.columns)[0]

    def find_by_id(self, row_id: Any, for_update: bool = False):
        query = select(self.table).where(self._pk() == row_id)
        if for_update:
            # Row lock (SELECT ... FOR UPDATE) on MySQL; no-op on SQLite, which serializes writers.
            query = query.with_for_update()
        return self.conn.execute(query).mappings().first()

    def insert(self, **values: Any) -> Any:
        result = self.conn.execute(insert(self.table).values(**values))
        return result.inserted_primary_key[0]

    def update(self, row_id: Any, **values: Any) -> int:
        result = self.conn.execute(update(self.table).where(self._pk() == row_id).values(**values))
        return result.rowcount
