"""Durable SQLAlchemy storage used by the marketplace API.

PostgreSQL is used when DATABASE_URL is configured. SQLite is deliberately kept
as a local/test fallback so the repository can be run without Docker.
"""
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

load_dotenv(Path(__file__).resolve().parents[3] / ".env")  # real env vars still win
DEFAULT_URL = f"sqlite:///{Path(__file__).resolve().parents[2] / 'roboeconomy.db'}"
def _normalize(url: str) -> str:
    """Accept postgres://, postgresql:// and +asyncpg URLs; always use the psycopg3 driver."""
    for prefix in ("postgresql+asyncpg://", "postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url

DATABASE_URL = _normalize(os.getenv("DATABASE_URL", DEFAULT_URL))
# prepare_threshold=None: Supabase's transaction pooler (port 6543) rejects prepared statements.
_connect_args = {"prepare_threshold": None} if DATABASE_URL.startswith("postgresql+psycopg") else {}
engine = create_engine(DATABASE_URL, future=True, pool_pre_ping=True, connect_args=_connect_args)
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
    model: Mapped[str | None] = mapped_column(String(120), nullable=True)
    available: Mapped[bool] = mapped_column(Boolean, default=True)
    min_price_minor: Mapped[int | None] = mapped_column(Integer, nullable=True)

class Mission(Base):
    __tablename__ = "missions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    description: Mapped[str] = mapped_column(Text); task_type: Mapped[str] = mapped_column(String(32)); budget_minor: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(3), default="USD"); status: Mapped[str] = mapped_column(String(48), default="PUBLISHED")
    awarded_bid_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, default=lambda: datetime.now(timezone.utc))

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
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, default=lambda: datetime.now(timezone.utc))

class WebhookEvent(Base):
    __tablename__ = "webhook_events"
    id: Mapped[str] = mapped_column(String(128), primary_key=True); event_type: Mapped[str] = mapped_column(String(96))


class AuditLog(Base):
    __tablename__ = "re_audit_logs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    actor: Mapped[str] = mapped_column(String(64)); action: Mapped[str] = mapped_column(String(64))
    resource: Mapped[str] = mapped_column(String(96)); detail: Mapped[str] = mapped_column(Text, default="{}")

class AgentRun(Base):
    __tablename__ = "re_agent_runs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    mission_id: Mapped[str] = mapped_column(ForeignKey("missions.id")); kind: Mapped[str] = mapped_column(String(24))
    status: Mapped[str] = mapped_column(String(24), default="COMPLETED"); summary: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class AgentDecision(Base):
    __tablename__ = "re_agent_decisions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    run_id: Mapped[str] = mapped_column(ForeignKey("re_agent_runs.id")); mission_id: Mapped[str] = mapped_column(String(36))
    seq: Mapped[int] = mapped_column(Integer); agent: Mapped[str] = mapped_column(String(32)); action: Mapped[str] = mapped_column(String(64))
    engine: Mapped[str] = mapped_column(String(64)); evidence: Mapped[str] = mapped_column(Text, default="{}"); explanation: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

# Columns added after the first release. create_all() never alters existing tables, so add them here.
_NEW_COLUMNS = {
    "robots": {"model": "VARCHAR(120)", "available": "BOOLEAN DEFAULT TRUE", "min_price_minor": "INTEGER"},
    "missions": {"created_at": "TIMESTAMP"},
    "payment_intents": {"created_at": "TIMESTAMP"},
}

def ensure_columns() -> None:
    insp = inspect(engine)
    with engine.begin() as conn:
        for table, cols in _NEW_COLUMNS.items():
            if not insp.has_table(table):
                continue
            have = {c["name"] for c in insp.get_columns(table)}
            for name, ddl in cols.items():
                if name not in have:
                    if engine.dialect.name == "sqlite":
                        ddl = ddl.replace("DEFAULT TRUE", "DEFAULT 1")
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))
