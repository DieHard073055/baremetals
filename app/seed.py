from datetime import datetime, timezone

import bcrypt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account
from app.models.enums import Role
from app.models.system_config import SystemConfig

DEFAULTS = {
    "mvr_usd_rate": "15.42",
    "price_cache_ttl_hours": "24",
}


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


async def run(session: AsyncSession) -> None:
    await _seed_admin(session)
    await _seed_config(session)
    await session.commit()


async def _seed_admin(session: AsyncSession) -> None:
    result = await session.execute(
        select(Account).where(Account.email == "admin@baremetals.mv")
    )
    if result.scalar_one_or_none() is not None:
        return

    admin = Account(
        name="Admin",
        email="admin@baremetals.mv",
        password_hash=hash_password("changeme123"),
        role=Role.admin,
        account_type=None,
        is_active=True,
        created_by=None,
        created_at=datetime.now(timezone.utc),
    )
    session.add(admin)


async def _seed_config(session: AsyncSession) -> None:
    for key, value in DEFAULTS.items():
        result = await session.execute(select(SystemConfig).where(SystemConfig.key == key))
        if result.scalar_one_or_none() is None:
            session.add(SystemConfig(key=key, value=value, updated_at=datetime.now(timezone.utc)))
