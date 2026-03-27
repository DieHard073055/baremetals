from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, model_validator
from sqlalchemy import select, exists
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import hash_password
from app.database import get_db
from app.deps import require_admin, require_admin_or_ops
from app.models.account import Account
from app.models.deposit import AllocatedBar, Deposit, TokenBalance
from app.models.enums import AccountType, Role
from app.models.withdrawal import WithdrawalBar

router = APIRouter(prefix="/accounts", tags=["accounts"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class AccountCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Role
    account_type: AccountType | None = None

    @model_validator(mode="after")
    def account_type_required_for_client(self):
        if self.role == Role.client and self.account_type is None:
            raise ValueError("account_type is required for client accounts")
        if self.role != Role.client and self.account_type is not None:
            raise ValueError("account_type must be null for admin/ops accounts")
        return self


class AccountResponse(BaseModel):
    id: int
    name: str
    email: str
    role: Role
    account_type: AccountType | None
    is_active: bool

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
async def create_account(
    body: AccountCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Account = Depends(require_admin),
):
    account = Account(
        name=body.name,
        email=body.email,
        password_hash=hash_password(body.password),
        role=body.role,
        account_type=body.account_type,
        is_active=True,
        created_by=current_user.id,
    )
    db.add(account)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already in use")
    return account


@router.get("", response_model=list[AccountResponse])
async def list_accounts(
    db: AsyncSession = Depends(get_db),
    _: Account = Depends(require_admin_or_ops),
):
    result = await db.execute(select(Account).order_by(Account.id))
    return result.scalars().all()


@router.get("/{account_id}", response_model=AccountResponse)
async def get_account(
    account_id: int,
    db: AsyncSession = Depends(get_db),
    _: Account = Depends(require_admin_or_ops),
):
    result = await db.execute(select(Account).where(Account.id == account_id))
    account = result.scalar_one_or_none()
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return account


@router.patch("/{account_id}/deactivate", response_model=AccountResponse)
async def deactivate_account(
    account_id: int,
    db: AsyncSession = Depends(get_db),
    _: Account = Depends(require_admin),
):
    result = await db.execute(select(Account).where(Account.id == account_id))
    account = result.scalar_one_or_none()
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    # Block if any token balance > 0
    has_tokens = await db.scalar(
        select(exists().where(
            TokenBalance.account_id == account_id,
            TokenBalance.balance > 0,
        ))
    )
    if has_tokens:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Account has active token holdings and cannot be deactivated",
        )

    # Block if any allocated bar not yet withdrawn
    # An active bar is one linked to this account's deposits that has no withdrawal_bars record
    deposits_subq = select(Deposit.id).where(Deposit.account_id == account_id)
    withdrawn_subq = select(WithdrawalBar.bar_id)
    has_active_bars = await db.scalar(
        select(exists().where(
            AllocatedBar.deposit_id.in_(deposits_subq),
            AllocatedBar.id.not_in(withdrawn_subq),
        ))
    )
    if has_active_bars:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Account has active allocated bars and cannot be deactivated",
        )

    account.is_active = False
    await db.flush()
    return account
