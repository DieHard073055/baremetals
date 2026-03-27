from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import app.price_client as price_client
from app.database import get_db
from app.deps import get_current_user, require_admin
from app.models.account import Account
from app.models.enums import Metal
from app.models.metal_price import MetalPrice
from app.models.system_config import SystemConfig

router = APIRouter(prefix="/prices", tags=["prices"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class PriceItem(BaseModel):
    metal: Metal
    price_usd_per_troy_oz: float
    fetched_at: datetime
    stale: bool


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_ttl_hours(db: AsyncSession) -> int:
    result = await db.execute(
        select(SystemConfig).where(SystemConfig.key == "price_cache_ttl_hours")
    )
    row = result.scalar_one_or_none()
    return int(row.value) if row else 24


async def _latest_prices(db: AsyncSession) -> dict[Metal, MetalPrice]:
    """Return the most-recently fetched MetalPrice row per metal."""
    result = await db.execute(
        select(MetalPrice).order_by(MetalPrice.fetched_at.desc())
    )
    rows = result.scalars().all()
    latest: dict[Metal, MetalPrice] = {}
    for row in rows:
        if row.metal not in latest:
            latest[row.metal] = row
    return latest


def _is_fresh(fetched_at: datetime, ttl_hours: int) -> bool:
    age = datetime.now(timezone.utc) - fetched_at
    return age.total_seconds() < ttl_hours * 3600


async def _persist_prices(db: AsyncSession, prices: dict[Metal, float]) -> dict[Metal, MetalPrice]:
    now = datetime.now(timezone.utc)
    saved: dict[Metal, MetalPrice] = {}
    for metal, price in prices.items():
        row = MetalPrice(metal=metal, price_usd_per_troy_oz=price, fetched_at=now)
        db.add(row)
        saved[metal] = row
    await db.flush()
    return saved


def _build_response(cached: dict[Metal, MetalPrice], stale: bool) -> list[PriceItem]:
    return [
        PriceItem(
            metal=metal,
            price_usd_per_troy_oz=float(row.price_usd_per_troy_oz),
            fetched_at=row.fetched_at,
            stale=stale,
        )
        for metal, row in cached.items()
    ]


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("", response_model=list[PriceItem])
async def get_prices(
    db: AsyncSession = Depends(get_db),
    _: Account = Depends(get_current_user),
):
    ttl = await _get_ttl_hours(db)
    cached = await _latest_prices(db)

    # Any cached prices that are fresh → serve from cache without calling API
    if cached:
        oldest = min(row.fetched_at for row in cached.values())
        if _is_fresh(oldest, ttl):
            return _build_response(cached, stale=False)

    # Cache expired or incomplete — try to fetch fresh prices
    try:
        fresh = await price_client.fetch_prices()
        saved = await _persist_prices(db, fresh)
        # Merge with any metals not returned by API (shouldn't happen)
        cached.update(saved)
        return _build_response({m: saved[m] for m in fresh}, stale=False)
    except Exception:
        # API unreachable
        if not cached:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Metal price service unavailable and no cached prices exist",
            )
        return _build_response(cached, stale=True)


@router.post("/refresh", response_model=list[PriceItem])
async def refresh_prices(
    db: AsyncSession = Depends(get_db),
    _: Account = Depends(require_admin),
):
    try:
        fresh = await price_client.fetch_prices()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to fetch prices: {exc}",
        )
    saved = await _persist_prices(db, fresh)
    return _build_response(saved, stale=False)
