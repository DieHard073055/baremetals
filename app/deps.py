from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import decode_access_token
from app.database import get_db
from app.models.account import Account
from app.models.enums import Role

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> Account:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exc
    except JWTError:
        raise credentials_exc

    result = await db.execute(select(Account).where(Account.id == int(user_id)))
    account = result.scalar_one_or_none()
    if account is None or not account.is_active:
        raise credentials_exc
    return account


def require_role(*roles: Role):
    """Return a dependency that enforces the given roles."""
    async def _check(current_user: Account = Depends(get_current_user)) -> Account:
        if current_user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return current_user
    return _check


require_admin = require_role(Role.admin)
require_ops = require_role(Role.ops)
require_admin_or_ops = require_role(Role.admin, Role.ops)
require_client = require_role(Role.client)
