from backend.db.database import UnitOfWork
from backend.domain.models import Notification, User


class NotificationService:
    def __init__(self, uow: UnitOfWork):
        self.uow = uow

    def list_for(self, user: User) -> list[Notification]:
        """Admins see every simulated message; customers only those of their bookings."""
        with self.uow() as repos:
            return repos.notifications.list(None if user.is_admin else user.id)
