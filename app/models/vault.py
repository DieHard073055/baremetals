from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.enums import Metal, MetalEnum


class Vault(Base):
    __tablename__ = "vaults"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    latitude: Mapped[float] = mapped_column(Numeric(10, 7), nullable=False)
    longitude: Mapped[float] = mapped_column(Numeric(10, 7), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("accounts.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class UnallocatedPool(Base):
    __tablename__ = "unallocated_pools"

    vault_id: Mapped[int] = mapped_column(Integer, ForeignKey("vaults.id"), primary_key=True)
    metal: Mapped[Metal] = mapped_column(MetalEnum, primary_key=True)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
