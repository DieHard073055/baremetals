"""
Task 7 — Portfolio tests (TDD: written before implementation).

Covers:
  GET /portfolio/{account_id}
    retail:        token balances → kg, valuation in USD + MVR
    institutional: active bar list, valuation in USD + MVR
    no price:      holdings returned without valuations
    access guard:  client → own (200), other account (403); ops/admin → any (200)
"""
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import AccountType, Metal, Role, StorageType
from tests.factories import (
    create_account,
    create_allocated_bar,
    create_deposit,
    create_metal_price,
    create_token_balance,
    create_unallocated_pool,
    create_vault,
    create_withdrawal,
)


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Use price=31.1035 so that 1g ≡ exactly $1 USD (makes assertions clean)
_PRICE_PER_TROY_OZ = 31.1035  # USD per troy oz  →  1g = $1 exactly
_MVR_RATE = 15.42  # default seed value


async def _seed_price(db: AsyncSession, metal: Metal = Metal.gold) -> None:
    await create_metal_price(db, metal=metal, price_usd_per_troy_oz=_PRICE_PER_TROY_OZ)


# ---------------------------------------------------------------------------
# Retail portfolio
# ---------------------------------------------------------------------------

async def test_retail_portfolio_returns_token_balance(
    client: AsyncClient, ops_token: str, db_session: AsyncSession
):
    retail = await create_account(db_session, role=Role.client, account_type=AccountType.retail)
    await create_token_balance(db_session, account_id=retail.id, metal=Metal.gold, balance=5000)
    await _seed_price(db_session)

    resp = await client.get(f"/portfolio/{retail.id}", headers=auth(ops_token))
    assert resp.status_code == 200
    body = resp.json()
    gold = next(h for h in body["holdings"] if h["metal"] == "gold")
    assert gold["balance_tokens"] == 5000
    assert abs(gold["weight_kg"] - 0.5) < 1e-6  # 5000 * 0.1g / 1000 = 0.5 kg


async def test_retail_portfolio_valuation(
    client: AsyncClient, ops_token: str, db_session: AsyncSession
):
    retail = await create_account(db_session, role=Role.client, account_type=AccountType.retail)
    await create_token_balance(db_session, account_id=retail.id, metal=Metal.gold, balance=10000)
    await _seed_price(db_session)

    resp = await client.get(f"/portfolio/{retail.id}", headers=auth(ops_token))
    assert resp.status_code == 200
    gold = next(h for h in resp.json()["holdings"] if h["metal"] == "gold")
    # 10000 tokens = 1000g = $1000 USD (price=31.1035 $/troy_oz → 1g=$1)
    assert abs(gold["value_usd"] - 1000.0) < 0.01
    assert abs(gold["value_mvr"] - 1000.0 * _MVR_RATE) < 0.10
    assert gold["stale"] is False


# ---------------------------------------------------------------------------
# Institutional portfolio
# ---------------------------------------------------------------------------

async def test_institutional_portfolio_returns_active_bars(
    client: AsyncClient, ops_token: str, db_session: AsyncSession
):
    inst = await create_account(db_session, role=Role.client, account_type=AccountType.institutional)
    vault = await create_vault(db_session)
    deposit = await create_deposit(
        db_session, account_id=inst.id, vault_id=vault.id,
        storage_type=StorageType.allocated, token_amount=None, created_by=inst.id,
    )
    await create_allocated_bar(db_session, deposit_id=deposit.id, serial_number="PORT-001", weight_g=500.0)
    await _seed_price(db_session)

    resp = await client.get(f"/portfolio/{inst.id}", headers=auth(ops_token))
    assert resp.status_code == 200
    body = resp.json()
    gold = next(h for h in body["holdings"] if h["metal"] == "gold")
    assert len(gold["bars"]) == 1
    assert gold["bars"][0]["serial_number"] == "PORT-001"
    assert abs(gold["total_weight_g"] - 500.0) < 1e-6


async def test_institutional_portfolio_excludes_withdrawn_bars(
    client: AsyncClient, ops_token: str, db_session: AsyncSession
):
    inst = await create_account(db_session, role=Role.client, account_type=AccountType.institutional)
    vault = await create_vault(db_session)
    deposit = await create_deposit(
        db_session, account_id=inst.id, vault_id=vault.id,
        storage_type=StorageType.allocated, token_amount=None, created_by=inst.id,
    )
    bar = await create_allocated_bar(db_session, deposit_id=deposit.id, serial_number="PORT-W-001")
    await _seed_price(db_session)

    # Withdraw the bar via the API so WithdrawalBar record is created
    await client.post("/withdrawals", json={
        "account_id": inst.id, "storage_type": "allocated", "bar_ids": [bar.id],
    }, headers=auth(ops_token))

    resp = await client.get(f"/portfolio/{inst.id}", headers=auth(ops_token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["holdings"] == []  # bar was withdrawn, nothing left


async def test_institutional_portfolio_valuation(
    client: AsyncClient, ops_token: str, db_session: AsyncSession
):
    inst = await create_account(db_session, role=Role.client, account_type=AccountType.institutional)
    vault = await create_vault(db_session)
    deposit = await create_deposit(
        db_session, account_id=inst.id, vault_id=vault.id,
        storage_type=StorageType.allocated, token_amount=None, created_by=inst.id,
    )
    await create_allocated_bar(db_session, deposit_id=deposit.id, serial_number="PORT-VAL-001", weight_g=1000.0)
    await _seed_price(db_session)

    resp = await client.get(f"/portfolio/{inst.id}", headers=auth(ops_token))
    gold = next(h for h in resp.json()["holdings"] if h["metal"] == "gold")
    # 1000g = $1000 USD exactly (price=31.1035 → 1g=$1)
    assert abs(gold["value_usd"] - 1000.0) < 0.01
    assert abs(gold["value_mvr"] - 1000.0 * _MVR_RATE) < 0.10
    assert gold["stale"] is False


# ---------------------------------------------------------------------------
# No cached price
# ---------------------------------------------------------------------------

async def test_portfolio_no_price_returns_holdings_without_valuation(
    client: AsyncClient, ops_token: str, db_session: AsyncSession
):
    retail = await create_account(db_session, role=Role.client, account_type=AccountType.retail)
    await create_token_balance(db_session, account_id=retail.id, metal=Metal.gold, balance=1000)
    # No MetalPrice seeded

    resp = await client.get(f"/portfolio/{retail.id}", headers=auth(ops_token))
    assert resp.status_code == 200
    gold = next((h for h in resp.json()["holdings"] if h["metal"] == "gold"), None)
    assert gold is not None
    assert gold["value_usd"] is None
    assert gold["value_mvr"] is None


# ---------------------------------------------------------------------------
# Access control
# ---------------------------------------------------------------------------

async def test_client_can_access_own_portfolio(
    client: AsyncClient, db_session: AsyncSession
):
    retail = await create_account(db_session, role=Role.client, account_type=AccountType.retail)
    from app.auth import create_access_token
    token = create_access_token({"sub": str(retail.id)})
    await create_token_balance(db_session, account_id=retail.id, metal=Metal.gold, balance=100)
    await _seed_price(db_session)

    resp = await client.get(f"/portfolio/{retail.id}", headers=auth(token))
    assert resp.status_code == 200


async def test_client_cannot_access_other_portfolio(
    client: AsyncClient, retail_client_token: str,
    retail_client_account: object, db_session: AsyncSession
):
    other = await create_account(db_session, role=Role.client, account_type=AccountType.retail)
    resp = await client.get(f"/portfolio/{other.id}", headers=auth(retail_client_token))
    assert resp.status_code == 403


async def test_ops_can_access_any_portfolio(
    client: AsyncClient, ops_token: str, db_session: AsyncSession
):
    retail = await create_account(db_session, role=Role.client, account_type=AccountType.retail)
    await create_token_balance(db_session, account_id=retail.id, metal=Metal.gold, balance=100)
    await _seed_price(db_session)
    resp = await client.get(f"/portfolio/{retail.id}", headers=auth(ops_token))
    assert resp.status_code == 200


async def test_portfolio_account_not_found(
    client: AsyncClient, ops_token: str
):
    resp = await client.get("/portfolio/999999", headers=auth(ops_token))
    assert resp.status_code == 404
