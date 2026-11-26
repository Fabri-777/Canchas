from sqlalchemy import select

from backend.dao.base import BaseDAO
from backend.db.tables import payments


class PaymentDAO(BaseDAO):
    table = payments

    def find_receipt(self, booking_id: int):
        query = select(payments.c.receipt, payments.c.receipt_type).where(
            payments.c.booking_id == booking_id
        )
        return self.conn.execute(query).mappings().first()
