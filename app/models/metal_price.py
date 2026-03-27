from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, JSON, Numeric
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.enums import Metal, MetalEnum


class MetalPrice(Base):
    __tablename__ = "metal_prices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    metal: Mapped[Metal] = mapped_column(MetalEnum, nullable=False, index=True)
    price_usd_per_troy_oz: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    raw_response: Mapped[dict | None] = mapped_column(JSON, nullable=True)
