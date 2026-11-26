"""Repositories: collection-like access to domain entities.

A repository speaks in domain objects (User, Booking...) and composes one or more DAOs,
which are the only place that knows SQL. Services never see rows or tables.
"""
from functools import cached_property

from sqlalchemy import Connection

from backend.repositories.block_repository import BlockRepository
from backend.repositories.booking_repository import BookingRepository
from backend.repositories.court_repository import CourtRepository
from backend.repositories.notification_repository import NotificationRepository
from backend.repositories.user_repository import UserRepository


class Repositories:
    """Every repository bound to the same connection, i.e. the same transaction."""

    def __init__(self, conn: Connection):
        self.conn = conn

    @cached_property
    def users(self) -> UserRepository:
        return UserRepository(self.conn)

    @cached_property
    def courts(self) -> CourtRepository:
        return CourtRepository(self.conn)

    @cached_property
    def bookings(self) -> BookingRepository:
        return BookingRepository(self.conn)

    @cached_property
    def blocks(self) -> BlockRepository:
        return BlockRepository(self.conn)

    @cached_property
    def notifications(self) -> NotificationRepository:
        return NotificationRepository(self.conn)
