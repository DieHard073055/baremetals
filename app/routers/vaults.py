from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, exists
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import require_admin, require_admin_or_ops
from app.models.account import Account
from app.models.deposit import AllocatedBar, Deposit
from app.models.enums import Metal
from app.models.vault import UnallocatedPool, Vault
from app.models.withdrawal import WithdrawalBar

router = APIRouter(prefix="/vaults", tags=["vaults"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class VaultCreate(BaseModel):
    name: str
    latitude: float
    longitude: float


class VaultResponse(BaseModel):
    id: int
    name: str
    latitude: float
    longitude: float
    is_active: bool

    model_config = {"from_attributes": True}


class PoolSummary(BaseModel):
    metal: Metal
    total_tokens: int

    model_config = {"from_attributes": True}


class BarSummary(BaseModel):
    id: int
    serial_number: str
    weight_g: float
    metal: Metal


class VaultListItem(VaultResponse):
    gold_tokens: int = 0
    silver_tokens: int = 0
    platinum_tokens: int = 0
    gold_bar_weight_g: float = 0.0
    silver_bar_weight_g: float = 0.0
    platinum_bar_weight_g: float = 0.0


class VaultDetail(VaultResponse):
    pools: list[PoolSummary]
    bars: list[BarSummary]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_pools_by_vault(db: AsyncSession, vault_id: int) -> list[UnallocatedPool]:
    result = await db.execute(
        select(UnallocatedPool).where(UnallocatedPool.vault_id == vault_id)
    )
    return result.scalars().all()


async def _get_active_bars_for_vault(db: AsyncSession, vault_id: int) -> list[BarSummary]:
    """Return all bars in this vault that have not been withdrawn."""
    withdrawn_subq = select(WithdrawalBar.bar_id)
    result = await db.execute(
        select(AllocatedBar, Deposit.metal)
        .join(Deposit, AllocatedBar.deposit_id == Deposit.id)
        .where(
            Deposit.vault_id == vault_id,
            AllocatedBar.id.not_in(withdrawn_subq),
        )
    )
    return [
        BarSummary(id=bar.id, serial_number=bar.serial_number, weight_g=float(bar.weight_g), metal=metal)
        for bar, metal in result.all()
    ]


def _build_list_item(vault: Vault, pools: list[UnallocatedPool], bars: list[BarSummary]) -> VaultListItem:
    token_map = {p.metal: p.total_tokens for p in pools}
    weight_map: dict[Metal, float] = {}
    for b in bars:
        weight_map[b.metal] = weight_map.get(b.metal, 0.0) + b.weight_g
    return VaultListItem(
        id=vault.id,
        name=vault.name,
        latitude=float(vault.latitude),
        longitude=float(vault.longitude),
        is_active=vault.is_active,
        gold_tokens=token_map.get(Metal.gold, 0),
        silver_tokens=token_map.get(Metal.silver, 0),
        platinum_tokens=token_map.get(Metal.platinum, 0),
        gold_bar_weight_g=weight_map.get(Metal.gold, 0.0),
        silver_bar_weight_g=weight_map.get(Metal.silver, 0.0),
        platinum_bar_weight_g=weight_map.get(Metal.platinum, 0.0),
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("", response_model=VaultResponse, status_code=status.HTTP_201_CREATED)
async def create_vault(
    body: VaultCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Account = Depends(require_admin),
):
    vault = Vault(
        name=body.name,
        latitude=body.latitude,
        longitude=body.longitude,
        is_active=True,
        created_by=current_user.id,
    )
    db.add(vault)
    await db.flush()
    return VaultResponse(
        id=vault.id,
        name=vault.name,
        latitude=float(vault.latitude),
        longitude=float(vault.longitude),
        is_active=vault.is_active,
    )


@router.get("", response_model=list[VaultListItem])
async def list_vaults(
    db: AsyncSession = Depends(get_db),
    _: Account = Depends(require_admin_or_ops),
):
    vaults_result = await db.execute(select(Vault).order_by(Vault.id))
    vaults = vaults_result.scalars().all()

    items = []
    for vault in vaults:
        pools = await _get_pools_by_vault(db, vault.id)
        bars = await _get_active_bars_for_vault(db, vault.id)
        items.append(_build_list_item(vault, pools, bars))
    return items


@router.get("/{vault_id}", response_model=VaultDetail)
async def get_vault(
    vault_id: int,
    db: AsyncSession = Depends(get_db),
    _: Account = Depends(require_admin_or_ops),
):
    result = await db.execute(select(Vault).where(Vault.id == vault_id))
    vault = result.scalar_one_or_none()
    if vault is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vault not found")

    pools = await _get_pools_by_vault(db, vault_id)
    bars = await _get_active_bars_for_vault(db, vault_id)

    return VaultDetail(
        id=vault.id,
        name=vault.name,
        latitude=float(vault.latitude),
        longitude=float(vault.longitude),
        is_active=vault.is_active,
        pools=[PoolSummary(metal=p.metal, total_tokens=p.total_tokens) for p in pools],
        bars=bars,
    )


@router.patch("/{vault_id}/deactivate", response_model=VaultResponse)
async def deactivate_vault(
    vault_id: int,
    db: AsyncSession = Depends(get_db),
    _: Account = Depends(require_admin),
):
    result = await db.execute(select(Vault).where(Vault.id == vault_id))
    vault = result.scalar_one_or_none()
    if vault is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vault not found")

    # Block if any pool has tokens
    has_tokens = await db.scalar(
        select(exists().where(
            UnallocatedPool.vault_id == vault_id,
            UnallocatedPool.total_tokens > 0,
        ))
    )
    if has_tokens:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Vault has active unallocated holdings and cannot be deactivated",
        )

    # Block if any active bar in this vault
    withdrawn_subq = select(WithdrawalBar.bar_id)
    deposits_subq = select(Deposit.id).where(Deposit.vault_id == vault_id)
    has_active_bars = await db.scalar(
        select(exists().where(
            AllocatedBar.deposit_id.in_(deposits_subq),
            AllocatedBar.id.not_in(withdrawn_subq),
        ))
    )
    if has_active_bars:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Vault has active allocated bars and cannot be deactivated",
        )

    vault.is_active = False
    await db.flush()
    return VaultResponse(
        id=vault.id,
        name=vault.name,
        latitude=float(vault.latitude),
        longitude=float(vault.longitude),
        is_active=vault.is_active,
    )
