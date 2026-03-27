from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.enums import Metal, MetalEnum, StorageType, StorageTypeEnum


class Deposit(Base):
    __tablename__ = "deposits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    deposit_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    account_id: Mapped[int] = mapped_column(Integer, ForeignKey("accounts.id"), nullable=False)
    vault_id: Mapped[int] = mapped_column(Integer, ForeignKey("vaults.id"), nullable=False)
    metal: Mapped[Metal] = mapped_column(MetalEnum, nullable=False)
    storage_type: Mapped[StorageType] = mapped_column(StorageTypeEnum, nullable=False)
    token_amount: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_by: Mapped[int] = mapped_column(Integer, ForeignKey("accounts.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class AllocatedBar(Base):
    __tablename__ = "allocated_bars"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    deposit_id: Mapped[int] = mapped_column(Integer, ForeignKey("deposits.id"), nullable=False)
    serial_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    weight_g: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)


class TokenBalance(Base):
    __tablename__ = "token_balances"

    account_id: Mapped[int] = mapped_column(Integer, ForeignKey("accounts.id"), primary_key=True)
    metal: Mapped[Metal] = mapped_column(MetalEnum, primary_key=True)
    balance: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
