from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.enums import Metal, MetalEnum, StorageType, StorageTypeEnum


class Withdrawal(Base):
    __tablename__ = "withdrawals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    withdrawal_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    account_id: Mapped[int] = mapped_column(Integer, ForeignKey("accounts.id"), nullable=False)
    vault_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("vaults.id"), nullable=True)
    metal: Mapped[Metal | None] = mapped_column(MetalEnum, nullable=True)
    storage_type: Mapped[StorageType] = mapped_column(StorageTypeEnum, nullable=False)
    token_amount: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_by: Mapped[int] = mapped_column(Integer, ForeignKey("accounts.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class WithdrawalBar(Base):
    __tablename__ = "withdrawal_bars"

    withdrawal_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("withdrawals.id"), primary_key=True
    )
    bar_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("allocated_bars.id"), primary_key=True
    )
