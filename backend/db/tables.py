"""Table definitions (SQLAlchemy Core). The single source of truth for the schema."""
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    MetaData,
    Numeric,
    String,
    Table,
    UniqueConstraint,
)
from sqlalchemy.dialects import mysql

metadata = MetaData()

users = Table(
    "users",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("name", String(100), nullable=False),
    Column("email", String(150), nullable=False, unique=True),
    Column("phone", String(9), nullable=False),
    Column("is_admin", Boolean, nullable=False, default=False),
    Column("password_hash", String(64)),
    Column("password_salt", String(32)),
    Column("created_at", DateTime, nullable=False),
)

sessions = Table(
    "sessions",
    metadata,
    Column("token_hash", String(64), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
    Column("expires_at", DateTime, nullable=False),
    Index("ix_sessions_expires", "expires_at"),
)

courts = Table(
    "courts",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("name", String(80), nullable=False),
    Column("sport", String(10), nullable=False),
    Column("description", String(180), nullable=False),
    Column("district", String(70), nullable=False),
    Column("price", Numeric(10, 2), nullable=False),
    Column("capacity", Integer, nullable=False),
    Column("opens_at", Integer, nullable=False),
    Column("closes_at", Integer, nullable=False),
    Column("active", Boolean, nullable=False, default=True),
)

bookings = Table(
    "bookings",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("user_id", Integer, ForeignKey("users.id"), nullable=False),
    Column("court_id", Integer, ForeignKey("courts.id"), nullable=False),
    Column("start_at", DateTime, nullable=False),
    Column("total", Numeric(10, 2), nullable=False),
    Column("status", String(10), nullable=False),
    Column("expires_at", DateTime, nullable=False),
    Column("created_at", DateTime, nullable=False),
    Index("ix_bookings_court_start", "court_id", "start_at"),
    Index("ix_bookings_user", "user_id"),
    Index("ix_bookings_status_expires", "status", "expires_at"),
)

payments = Table(
    "payments",
    metadata,
    Column("booking_id", Integer, ForeignKey("bookings.id", ondelete="CASCADE"), primary_key=True),
    Column("method", String(12), nullable=False),
    Column("status", String(10), nullable=False),
    Column("receipt", LargeBinary().with_variant(mysql.MEDIUMBLOB(), "mysql")),
    Column("receipt_type", String(20)),
)

blocks = Table(
    "blocks",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("court_id", Integer, ForeignKey("courts.id"), nullable=False),
    Column("start_at", DateTime, nullable=False),
    Column("reason", String(120), nullable=False),
    UniqueConstraint("court_id", "start_at", name="uq_blocks_court_start"),
)

notifications = Table(
    "notifications",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("booking_id", Integer, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False),
    Column("kind", String(15), nullable=False),
    Column("text", String(255), nullable=False),
    Column("channel", String(20), nullable=False),
    Column("scheduled_at", DateTime, nullable=False),
    Column("status", String(10), nullable=False),
    UniqueConstraint("booking_id", "kind", name="uq_notifications_booking_kind"),
    Index("ix_notifications_status_scheduled", "status", "scheduled_at"),
)
