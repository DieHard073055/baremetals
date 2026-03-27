"""
Task 4 — Vaults tests (TDD: written before implementation).

Covers:
  POST  /vaults                  create; non-admin → 403
  GET   /vaults                  list with per-metal token + bar-weight totals
  GET   /vaults/{id}             detail + inventory; not found → 404
  PATCH /vaults/{id}/deactivate  empty → 200; active pool → 409; active bars → 409
"""
from decimal import Decimal

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import AccountType, Metal, Role, StorageType
from tests.factories import (
    create_account,
    create_allocated_bar,
    create_deposit,
    create_unallocated_pool,
    create_vault,
)


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# POST /vaults
# ---------------------------------------------------------------------------

async def test_create_vault(client: AsyncClient, admin_token: str):
    resp = await client.post("/vaults", json={
        "name": "Male Vault",
        "latitude": 4.1755,
        "longitude": 73.5093,
    }, headers=auth(admin_token))
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Male Vault"
    assert body["is_active"] is True
    assert "id" in body


async def test_create_vault_ops_forbidden(client: AsyncClient, ops_token: str):
    resp = await client.post("/vaults", json={
        "name": "X", "latitude": 4.0, "longitude": 73.0,
    }, headers=auth(ops_token))
    assert resp.status_code == 403


async def test_create_vault_client_forbidden(client: AsyncClient, retail_client_token: str):
    resp = await client.post("/vaults", json={
        "name": "X", "latitude": 4.0, "longitude": 73.0,
    }, headers=auth(retail_client_token))
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# GET /vaults
# ---------------------------------------------------------------------------

async def test_list_vaults_includes_metal_totals(
    client: AsyncClient, admin_token: str, db_session: AsyncSession
):
    vault = await create_vault(db_session, name="Totals Vault")
    await create_unallocated_pool(db_session, vault_id=vault.id, metal=Metal.gold, total_tokens=5000)
    await create_unallocated_pool(db_session, vault_id=vault.id, metal=Metal.silver, total_tokens=2000)

    resp = await client.get("/vaults", headers=auth(admin_token))
    assert resp.status_code == 200
    vaults = resp.json()
    match = next((v for v in vaults if v["id"] == vault.id), None)
    assert match is not None
    assert match["gold_tokens"] == 5000
    assert match["silver_tokens"] == 2000
    assert match["platinum_tokens"] == 0


async def test_list_vaults_empty_totals_default_zero(
    client: AsyncClient, admin_token: str, db_session: AsyncSession
):
    vault = await create_vault(db_session, name="Empty Vault")
    resp = await client.get("/vaults", headers=auth(admin_token))
    match = next((v for v in resp.json() if v["id"] == vault.id), None)
    assert match["gold_tokens"] == 0
    assert match["silver_tokens"] == 0
    assert match["platinum_tokens"] == 0


# ---------------------------------------------------------------------------
# GET /vaults/{id}
# ---------------------------------------------------------------------------

async def test_get_vault_detail(
    client: AsyncClient, admin_token: str, db_session: AsyncSession
):
    vault = await create_vault(db_session, name="Detail Vault")
    await create_unallocated_pool(db_session, vault_id=vault.id, metal=Metal.gold, total_tokens=100)

    resp = await client.get(f"/vaults/{vault.id}", headers=auth(admin_token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == vault.id
    assert "pools" in body
    assert "bars" in body


async def test_get_vault_detail_with_active_bars(
    client: AsyncClient, admin_token: str, db_session: AsyncSession
):
    account = await create_account(
        db_session, role=Role.client, account_type=AccountType.institutional
    )
    vault = await create_vault(db_session)
    deposit = await create_deposit(
        db_session,
        account_id=account.id, vault_id=vault.id,
        storage_type=StorageType.allocated, token_amount=None,
        created_by=account.id,
    )
    bar = await create_allocated_bar(db_session, deposit_id=deposit.id, serial_number="SN-DETAIL-01", weight_g=500.0)

    resp = await client.get(f"/vaults/{vault.id}", headers=auth(admin_token))
    assert resp.status_code == 200
    bars = resp.json()["bars"]
    assert any(b["serial_number"] == bar.serial_number for b in bars)


async def test_get_vault_not_found(client: AsyncClient, admin_token: str):
    resp = await client.get("/vaults/999999", headers=auth(admin_token))
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# PATCH /vaults/{id}/deactivate
# ---------------------------------------------------------------------------

async def test_deactivate_empty_vault(
    client: AsyncClient, admin_token: str, db_session: AsyncSession
):
    vault = await create_vault(db_session, name="Empty For Deact")
    resp = await client.patch(f"/vaults/{vault.id}/deactivate", headers=auth(admin_token))
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False


async def test_deactivate_vault_with_active_pool_blocked(
    client: AsyncClient, admin_token: str, db_session: AsyncSession
):
    vault = await create_vault(db_session)
    await create_unallocated_pool(db_session, vault_id=vault.id, metal=Metal.gold, total_tokens=1)
    resp = await client.patch(f"/vaults/{vault.id}/deactivate", headers=auth(admin_token))
    assert resp.status_code == 409


async def test_deactivate_vault_with_active_bars_blocked(
    client: AsyncClient, admin_token: str, db_session: AsyncSession
):
    account = await create_account(
        db_session, role=Role.client, account_type=AccountType.institutional
    )
    vault = await create_vault(db_session)
    deposit = await create_deposit(
        db_session,
        account_id=account.id, vault_id=vault.id,
        storage_type=StorageType.allocated, token_amount=None,
        created_by=account.id,
    )
    await create_allocated_bar(db_session, deposit_id=deposit.id)
    resp = await client.patch(f"/vaults/{vault.id}/deactivate", headers=auth(admin_token))
    assert resp.status_code == 409


async def test_deactivate_vault_non_admin_forbidden(
    client: AsyncClient, ops_token: str, db_session: AsyncSession
):
    vault = await create_vault(db_session)
    resp = await client.patch(f"/vaults/{vault.id}/deactivate", headers=auth(ops_token))
    assert resp.status_code == 403
