from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

import uuid

from app.database import get_db
from app.deps import get_current_user, require_admin_or_ops, require_ops
from app.models.account import Account
from app.models.deposit import AllocatedBar, Deposit, TokenBalance
from app.models.enums import AccountType, Metal, Role, StorageType
from app.models.vault import UnallocatedPool

router = APIRouter(prefix="/deposits", tags=["deposits"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class BarInput(BaseModel):
    serial_number: str
    weight_g: float


class DepositCreate(BaseModel):
    account_id: int
    vault_id: int
    metal: Metal
    storage_type: StorageType
    token_amount: int | None = None
    bars: list[BarInput] = []

    @field_validator("token_amount")
    @classmethod
    def token_amount_positive(cls, v):
        if v is not None and v <= 0:
            raise ValueError("token_amount must be positive")
        return v


class BarResponse(BaseModel):
    id: int
    serial_number: str
    weight_g: float

    model_config = {"from_attributes": True}


class DepositResponse(BaseModel):
    id: int
    deposit_number: str
    account_id: int
    vault_id: int
    metal: Metal
    storage_type: StorageType | None = None
    token_amount: int | None
    bars: list[BarResponse] = []

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_bars_for_deposit(db: AsyncSession, deposit_id: int) -> list[AllocatedBar]:
    result = await db.execute(
        select(AllocatedBar).where(AllocatedBar.deposit_id == deposit_id)
    )
    return result.scalars().all()


def _deposit_response(deposit: Deposit, bars: list[AllocatedBar]) -> DepositResponse:
    return DepositResponse(
        id=deposit.id,
        deposit_number=deposit.deposit_number,
        account_id=deposit.account_id,
        vault_id=deposit.vault_id,
        metal=deposit.metal,
        storage_type=deposit.storage_type,
        token_amount=deposit.token_amount,
        bars=[BarResponse(id=b.id, serial_number=b.serial_number, weight_g=float(b.weight_g)) for b in bars],
    )




# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("", response_model=DepositResponse, status_code=status.HTTP_201_CREATED)
async def create_deposit(
    body: DepositCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Account = Depends(require_ops),
):
    # Look up account
    result = await db.execute(select(Account).where(Account.id == body.account_id))
    account = result.scalar_one_or_none()
    if account is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Account not found")

    # Validate storage_type vs account_type
    if body.storage_type == StorageType.unallocated and account.account_type != AccountType.retail:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only retail accounts can use unallocated storage",
        )
    if body.storage_type == StorageType.allocated and account.account_type != AccountType.institutional:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only institutional accounts can use allocated storage",
        )

    if body.storage_type == StorageType.unallocated:
        if not body.token_amount:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="token_amount is required for unallocated deposits",
            )
        return await _create_unallocated_deposit(db, body, current_user)
    else:
        return await _create_allocated_deposit(db, body, current_user)


async def _create_unallocated_deposit(
    db: AsyncSession, body: DepositCreate, current_user: Account
) -> DepositResponse:
    deposit_number = f"DEP-{uuid.uuid4().hex[:12].upper()}"

    deposit = Deposit(
        deposit_number=deposit_number,
        account_id=body.account_id,
        vault_id=body.vault_id,
        metal=body.metal,
        storage_type=StorageType.unallocated,
        token_amount=body.token_amount,
        created_by=current_user.id,
    )
    db.add(deposit)
    await db.flush()

    # Upsert pool: increment or create
    pool_result = await db.execute(
        select(UnallocatedPool).where(
            UnallocatedPool.vault_id == body.vault_id,
            UnallocatedPool.metal == body.metal,
        )
    )
    pool = pool_result.scalar_one_or_none()
    if pool is None:
        pool = UnallocatedPool(vault_id=body.vault_id, metal=body.metal, total_tokens=body.token_amount)
        db.add(pool)
    else:
        pool.total_tokens += body.token_amount
    await db.flush()

    # Upsert token balance: increment or create
    bal_result = await db.execute(
        select(TokenBalance).where(
            TokenBalance.account_id == body.account_id,
            TokenBalance.metal == body.metal,
        )
    )
    bal = bal_result.scalar_one_or_none()
    if bal is None:
        bal = TokenBalance(account_id=body.account_id, metal=body.metal, balance=body.token_amount)
        db.add(bal)
    else:
        bal.balance += body.token_amount
    await db.flush()

    return _deposit_response(deposit, [])


async def _create_allocated_deposit(
    db: AsyncSession, body: DepositCreate, current_user: Account
) -> DepositResponse:
    deposit_number = f"DEP-{uuid.uuid4().hex[:12].upper()}"

    deposit = Deposit(
        deposit_number=deposit_number,
        account_id=body.account_id,
        vault_id=body.vault_id,
        metal=body.metal,
        storage_type=StorageType.allocated,
        token_amount=None,
        created_by=current_user.id,
    )
    db.add(deposit)
    await db.flush()

    bars = []
    for bar_input in body.bars:
        bar = AllocatedBar(
            deposit_id=deposit.id,
            serial_number=bar_input.serial_number,
            weight_g=bar_input.weight_g,
        )
        db.add(bar)
        try:
            await db.flush()
        except IntegrityError:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Bar with serial number '{bar_input.serial_number}' already exists",
            )
        bars.append(bar)

    return _deposit_response(deposit, bars)


@router.get("", response_model=list[DepositResponse])
async def list_deposits(
    db: AsyncSession = Depends(get_db),
    current_user: Account = Depends(get_current_user),
):
    query = select(Deposit).order_by(Deposit.id)
    if current_user.role == Role.client:
        query = query.where(Deposit.account_id == current_user.id)
    elif current_user.role not in (Role.admin, Role.ops):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    is_client = current_user.role == Role.client
    result = await db.execute(query)
    deposits = result.scalars().all()
    items = []
    for deposit in deposits:
        bars = await _get_bars_for_deposit(db, deposit.id)
        resp = _deposit_response(deposit, bars)
        if is_client:
            resp.storage_type = None
        items.append(resp)
    return items


@router.get("/{deposit_id}", response_model=DepositResponse)
async def get_deposit(
    deposit_id: int,
    db: AsyncSession = Depends(get_db),
    _: Account = Depends(require_admin_or_ops),
):
    result = await db.execute(select(Deposit).where(Deposit.id == deposit_id))
    deposit = result.scalar_one_or_none()
    if deposit is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deposit not found")
    bars = await _get_bars_for_deposit(db, deposit.id)
    return _deposit_response(deposit, bars)
