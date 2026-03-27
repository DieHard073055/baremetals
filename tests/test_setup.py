"""
Task 0 + 1 tests: infrastructure sanity checks.
All tests here should pass after project setup is complete.
"""
import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app import seed
from app.models.enums import Role


EXPECTED_TABLES = {
    "accounts",
    "vaults",
    "unallocated_pools",
    "token_balances",
    "deposits",
    "allocated_bars",
    "withdrawals",
    "withdrawal_bars",
    "metal_prices",
    "system_config",
}


async def test_health_check(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_all_tables_exist(db_session: AsyncSession):
    result = await db_session.execute(
        text("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
    )
    tables = {row[0] for row in result}
    missing = EXPECTED_TABLES - tables
    assert not missing, f"Missing tables: {missing}"


async def test_seed_creates_admin(db_session: AsyncSession):
    await seed.run(db_session)

    from sqlalchemy import select
    from app.models.account import Account

    result = await db_session.execute(
        select(Account).where(Account.email == "admin@baremetals.mv")
    )
    admin = result.scalar_one_or_none()
    assert admin is not None
    assert admin.role == Role.admin
    assert admin.is_active is True


async def test_seed_creates_default_config(db_session: AsyncSession):
    await seed.run(db_session)

    from sqlalchemy import select
    from app.models.system_config import SystemConfig

    result = await db_session.execute(select(SystemConfig))
    configs = {row.key: row.value for row in result.scalars()}

    assert configs.get("mvr_usd_rate") == "15.42"
    assert configs.get("price_cache_ttl_hours") == "24"


async def test_seed_is_idempotent(db_session: AsyncSession):
    """Running seed twice should not raise or duplicate the admin."""
    await seed.run(db_session)
    await seed.run(db_session)

    from sqlalchemy import select, func
    from app.models.account import Account

    result = await db_session.execute(
        select(func.count()).where(Account.email == "admin@baremetals.mv")
    )
    count = result.scalar_one()
    assert count == 1
