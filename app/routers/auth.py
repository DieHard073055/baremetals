from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import create_access_token, verify_password
from app.database import get_db
from app.deps import get_current_user
from app.models.account import Account
from app.models.enums import AccountType, Role

router = APIRouter(prefix="/auth", tags=["auth"])


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MeResponse(BaseModel):
    id: int
    name: str
    email: str
    role: Role
    account_type: AccountType | None

    model_config = {"from_attributes": True}


@router.post("/login", response_model=TokenResponse)
async def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Account).where(Account.email == form.username))
    account = result.scalar_one_or_none()

    if account is None or not verify_password(form.password, account.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not account.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token({"sub": str(account.id)})
    return TokenResponse(access_token=token)


@router.get("/me", response_model=MeResponse)
async def me(current_user: Account = Depends(get_current_user)):
    return current_user
