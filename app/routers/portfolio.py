from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.account import Account
from app.models.deposit import AllocatedBar, Deposit, TokenBalance
from app.models.enums import AccountType, Metal, Role
from app.models.metal_price import MetalPrice
from app.models.system_config import SystemConfig
from app.models.withdrawal import WithdrawalBar

router = APIRouter(prefix="/portfolio", tags=["portfolio"])

# 1 troy oz = 31.1035 grams
_TROY_OZ_PER_G = 1.0 / 31.1035


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class BarDetail(BaseModel):
    id: int
    serial_number: str
    weight_g: float


class HoldingItem(BaseModel):
    metal: Metal
    # Retail fields
    balance_tokens: int | None = None
    weight_kg: float | None = None
    # Institutional fields
    bars: list[BarDetail] = []
    total_weight_g: float | None = None
    # Valuation
    value_usd: float | None = None
    value_mvr: float | None = None
    stale: bool | None = None


class PortfolioResponse(BaseModel):
    account_id: int
    account_type: AccountType
    holdings: list[HoldingItem]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_latest_prices(db: AsyncSession) -> dict[Metal, tuple[float, bool]]:
    """
    Returns {Metal: (price_usd_per_troy_oz, stale)} using the most-recent
    MetalPrice row per metal. 'stale' is always False here; the caller decides
    based on TTL. If no rows exist, returns empty dict.
    """
    result = await db.execute(
        select(MetalPrice).order_by(MetalPrice.fetched_at.desc())
    )
    rows = result.scalars().all()
    latest: dict[Metal, MetalPrice] = {}
    for row in rows:
        if row.metal not in latest:
            latest[row.metal] = row
    return {metal: float(row.price_usd_per_troy_oz) for metal, row in latest.items()}


async def _get_mvr_rate(db: AsyncSession) -> float:
    result = await db.execute(
        select(SystemConfig).where(SystemConfig.key == "mvr_usd_rate")
    )
    row = result.scalar_one_or_none()
    return float(row.value) if row else 15.42


def _value(weight_g: float, price_usd: float, mvr_rate: float) -> tuple[float, float]:
    troy_oz = weight_g * _TROY_OZ_PER_G
    usd = round(troy_oz * price_usd, 4)
    mvr = round(usd * mvr_rate, 4)
    return usd, mvr


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

@router.get("/{account_id}", response_model=PortfolioResponse)
async def get_portfolio(
    account_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Account = Depends(get_current_user),
):
    # Access control: clients can only see their own portfolio
    if current_user.role == Role.client and current_user.id != account_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    result = await db.execute(select(Account).where(Account.id == account_id))
    account = result.scalar_one_or_none()
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    prices = await _get_latest_prices(db)
    mvr_rate = await _get_mvr_rate(db)

    if account.account_type == AccountType.retail:
        holdings = await _retail_holdings(db, account_id, prices, mvr_rate)
    else:
        holdings = await _institutional_holdings(db, account_id, prices, mvr_rate)

    return PortfolioResponse(
        account_id=account_id,
        account_type=account.account_type,
        holdings=holdings,
    )


async def _retail_holdings(
    db: AsyncSession,
    account_id: int,
    prices: dict[Metal, float],
    mvr_rate: float,
) -> list[HoldingItem]:
    result = await db.execute(
        select(TokenBalance).where(TokenBalance.account_id == account_id)
    )
    balances = result.scalars().all()
    items = []
    for bal in balances:
        if bal.balance == 0:
            continue
        weight_g = bal.balance * 0.1
        weight_kg = weight_g / 1000.0
        price = prices.get(bal.metal)
        value_usd = value_mvr = stale = None
        if price is not None:
            value_usd, value_mvr = _value(weight_g, price, mvr_rate)
            stale = False
        items.append(HoldingItem(
            metal=bal.metal,
            balance_tokens=bal.balance,
            weight_kg=round(weight_kg, 6),
            value_usd=value_usd,
            value_mvr=value_mvr,
            stale=stale,
        ))
    return items


async def _institutional_holdings(
    db: AsyncSession,
    account_id: int,
    prices: dict[Metal, float],
    mvr_rate: float,
) -> list[HoldingItem]:
    # Active bars = bars not in withdrawal_bars, via deposits belonging to account
    withdrawn_subq = select(WithdrawalBar.bar_id)
    deposits_subq = select(Deposit.id).where(Deposit.account_id == account_id)

    result = await db.execute(
        select(AllocatedBar, Deposit.metal)
        .join(Deposit, AllocatedBar.deposit_id == Deposit.id)
        .where(
            AllocatedBar.deposit_id.in_(deposits_subq),
            AllocatedBar.id.not_in(withdrawn_subq),
        )
    )
    rows = result.all()

    # Group by metal
    by_metal: dict[Metal, list[tuple[AllocatedBar, Metal]]] = {}
    for bar, metal in rows:
        by_metal.setdefault(metal, []).append(bar)

    items = []
    for metal, bars in by_metal.items():
        total_weight_g = sum(float(b.weight_g) for b in bars)
        price = prices.get(metal)
        value_usd = value_mvr = stale = None
        if price is not None:
            value_usd, value_mvr = _value(total_weight_g, price, mvr_rate)
            stale = False
        items.append(HoldingItem(
            metal=metal,
            bars=[BarDetail(id=b.id, serial_number=b.serial_number, weight_g=float(b.weight_g)) for b in bars],
            total_weight_g=round(total_weight_g, 4),
            value_usd=value_usd,
            value_mvr=value_mvr,
            stale=stale,
        ))
    return items
