"""Durable SQLAlchemy storage used by the marketplace API.

PostgreSQL is used when DATABASE_URL is configured. SQLite is deliberately kept
as a local/test fallback so the repository can be run without Docker.
"""
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

DEFAULT_URL = f"sqlite:///{Path(__file__).resolve().parents[2] / 'roboeconomy.db'}"
DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_URL).replace("postgresql+asyncpg://", "postgresql+psycopg://")
engine = create_engine(DATABASE_URL, future=True, pool_pre_ping=True)
SessionLocal = sessionmaker(engine, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

class Robot(Base):
    __tablename__ = "robots"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(160)); owner: Mapped[str] = mapped_column(String(160))
    capability: Mapped[str] = mapped_column(String(32)); rate_minor: Mapped[int] = mapped_column(Integer)
    source: Mapped[str] = mapped_column(String(16)); status: Mapped[str] = mapped_column(String(48), default="registered-not-connected")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class Mission(Base):
    __tablename__ = "missions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    description: Mapped[str] = mapped_column(Text); task_type: Mapped[str] = mapped_column(String(32)); budget_minor: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(3), default="USD"); status: Mapped[str] = mapped_column(String(48), default="PUBLISHED")
    awarded_bid_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

class Bid(Base):
    __tablename__ = "bids"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    mission_id: Mapped[str] = mapped_column(ForeignKey("missions.id")); robot_id: Mapped[str] = mapped_column(ForeignKey("robots.id")); price_minor: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(24), default="SUBMITTED")

class PaymentIntent(Base):
    __tablename__ = "payment_intents"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    mission_id: Mapped[str] = mapped_column(ForeignKey("missions.id"), unique=True); amount_minor: Mapped[int] = mapped_column(Integer); currency: Mapped[str] = mapped_column(String(3))
    status: Mapped[str] = mapped_column(String(40), default="APPROVAL_REQUIRED"); paypal_order_id: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    request_id: Mapped[str] = mapped_column(String(64), unique=True); capture_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

class WebhookEvent(Base):
    __tablename__ = "webhook_events"
    id: Mapped[str] = mapped_column(String(128), primary_key=True); event_type: Mapped[str] = mapped_column(String(96))
