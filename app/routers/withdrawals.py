from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, require_admin_or_ops, require_ops
from app.models.enums import Role
from app.models.account import Account
from app.models.deposit import AllocatedBar, Deposit, TokenBalance
from app.models.enums import Metal, StorageType
from app.models.vault import UnallocatedPool
from app.models.withdrawal import Withdrawal, WithdrawalBar

router = APIRouter(prefix="/withdrawals", tags=["withdrawals"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class WithdrawalCreate(BaseModel):
    account_id: int
    storage_type: StorageType
    # Unallocated fields
    vault_id: int | None = None
    metal: Metal | None = None
    token_amount: int | None = None
    # Allocated fields
    bar_ids: list[int] = []


class WithdrawalResponse(BaseModel):
    id: int
    account_id: int
    vault_id: int | None
    metal: Metal | None
    storage_type: StorageType
    token_amount: int | None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("", response_model=WithdrawalResponse, status_code=status.HTTP_201_CREATED)
async def create_withdrawal(
    body: WithdrawalCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Account = Depends(require_ops),
):
    if body.storage_type == StorageType.unallocated:
        return await _create_unallocated_withdrawal(db, body, current_user)
    else:
        return await _create_allocated_withdrawal(db, body, current_user)


async def _create_unallocated_withdrawal(
    db: AsyncSession, body: WithdrawalCreate, current_user: Account
) -> WithdrawalResponse:
    if not body.vault_id or not body.metal or not body.token_amount:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="vault_id, metal, and token_amount are required for unallocated withdrawals",
        )

    # SELECT FOR UPDATE on pool to prevent concurrent overdraw
    pool_result = await db.execute(
        select(UnallocatedPool)
        .where(
            UnallocatedPool.vault_id == body.vault_id,
            UnallocatedPool.metal == body.metal,
        )
        .with_for_update()
    )
    pool = pool_result.scalar_one_or_none()
    if pool is None or pool.total_tokens < body.token_amount:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Insufficient pool balance",
        )

    # Check token balance
    bal_result = await db.execute(
        select(TokenBalance).where(
            TokenBalance.account_id == body.account_id,
            TokenBalance.metal == body.metal,
        )
    )
    bal = bal_result.scalar_one_or_none()
    if bal is None or bal.balance < body.token_amount:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Insufficient token balance",
        )

    # Decrement both atomically
    pool.total_tokens -= body.token_amount
    bal.balance -= body.token_amount
    await db.flush()

    withdrawal = Withdrawal(
        account_id=body.account_id,
        vault_id=body.vault_id,
        metal=body.metal,
        storage_type=StorageType.unallocated,
        token_amount=body.token_amount,
        created_by=current_user.id,
    )
    db.add(withdrawal)
    await db.flush()

    return WithdrawalResponse(
        id=withdrawal.id,
        account_id=withdrawal.account_id,
        vault_id=withdrawal.vault_id,
        metal=withdrawal.metal,
        storage_type=withdrawal.storage_type,
        token_amount=withdrawal.token_amount,
    )


async def _create_allocated_withdrawal(
    db: AsyncSession, body: WithdrawalCreate, current_user: Account
) -> WithdrawalResponse:
    if not body.bar_ids:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="bar_ids is required for allocated withdrawals",
        )

    # Validate each bar: must belong to account and not already withdrawn
    already_withdrawn_subq = select(WithdrawalBar.bar_id)

    for bar_id in body.bar_ids:
        bar_result = await db.execute(
            select(AllocatedBar)
            .join(Deposit, AllocatedBar.deposit_id == Deposit.id)
            .where(AllocatedBar.id == bar_id)
        )
        bar_row = bar_result.first()
        if bar_row is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Bar {bar_id} not found",
            )

        bar, = bar_row
        # Check ownership via deposit
        deposit_result = await db.execute(
            select(Deposit).where(Deposit.id == bar.deposit_id)
        )
        deposit = deposit_result.scalar_one_or_none()
        if deposit is None or deposit.account_id != body.account_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Bar {bar_id} does not belong to account {body.account_id}",
            )

        # Check not already withdrawn
        withdrawn_result = await db.execute(
            select(WithdrawalBar).where(WithdrawalBar.bar_id == bar_id)
        )
        if withdrawn_result.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Bar {bar_id} has already been withdrawn",
            )

    withdrawal = Withdrawal(
        account_id=body.account_id,
        vault_id=None,
        metal=None,
        storage_type=StorageType.allocated,
        token_amount=None,
        created_by=current_user.id,
    )
    db.add(withdrawal)
    await db.flush()

    for bar_id in body.bar_ids:
        db.add(WithdrawalBar(withdrawal_id=withdrawal.id, bar_id=bar_id))
    await db.flush()

    return WithdrawalResponse(
        id=withdrawal.id,
        account_id=withdrawal.account_id,
        vault_id=withdrawal.vault_id,
        metal=withdrawal.metal,
        storage_type=withdrawal.storage_type,
        token_amount=withdrawal.token_amount,
    )


@router.get("", response_model=list[WithdrawalResponse])
async def list_withdrawals(
    db: AsyncSession = Depends(get_db),
    current_user: Account = Depends(get_current_user),
):
    query = select(Withdrawal).order_by(Withdrawal.id)
    if current_user.role == Role.client:
        query = query.where(Withdrawal.account_id == current_user.id)
    elif current_user.role not in (Role.admin, Role.ops):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    result = await db.execute(query)
    withdrawals = result.scalars().all()
    return [
        WithdrawalResponse(
            id=w.id,
            account_id=w.account_id,
            vault_id=w.vault_id,
            metal=w.metal,
            storage_type=w.storage_type,
            token_amount=w.token_amount,
        )
        for w in withdrawals
    ]
