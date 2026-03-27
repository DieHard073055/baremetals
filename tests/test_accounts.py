"""
Task 3 — Accounts tests (TDD: written before implementation).

Covers:
  POST   /accounts              create retail, institutional, ops; missing account_type → 422; non-admin → 403
  GET    /accounts              list all (admin/ops); client → 403
  GET    /accounts/{id}         detail; not found → 404
  PATCH  /accounts/{id}/deactivate  no holdings → 200; active token balance → 409; active bars → 409
"""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import AccountType, Metal, Role, StorageType
from tests.factories import (
    create_account,
    create_allocated_bar,
    create_deposit,
    create_token_balance,
    create_vault,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# POST /accounts
# ---------------------------------------------------------------------------

async def test_create_retail_client(client: AsyncClient, admin_token: str):
    resp = await client.post("/accounts", json={
        "name": "Alice",
        "email": "alice@test.com",
        "password": "pass1234",
        "role": "client",
        "account_type": "retail",
    }, headers=auth(admin_token))
    assert resp.status_code == 201
    body = resp.json()
    assert body["role"] == "client"
    assert body["account_type"] == "retail"
    assert body["is_active"] is True
    assert "password" not in body
    assert "password_hash" not in body


async def test_create_institutional_client(client: AsyncClient, admin_token: str):
    resp = await client.post("/accounts", json={
        "name": "Corp Inc",
        "email": "corp@test.com",
        "password": "pass1234",
        "role": "client",
        "account_type": "institutional",
    }, headers=auth(admin_token))
    assert resp.status_code == 201
    assert resp.json()["account_type"] == "institutional"


async def test_create_ops_account(client: AsyncClient, admin_token: str):
    resp = await client.post("/accounts", json={
        "name": "Ops User",
        "email": "ops@test.com",
        "password": "pass1234",
        "role": "ops",
    }, headers=auth(admin_token))
    assert resp.status_code == 201
    assert resp.json()["account_type"] is None


async def test_create_client_without_account_type_rejected(client: AsyncClient, admin_token: str):
    resp = await client.post("/accounts", json={
        "name": "Bad Client",
        "email": "bad@test.com",
        "password": "pass1234",
        "role": "client",
    }, headers=auth(admin_token))
    assert resp.status_code == 422


async def test_create_account_non_admin_rejected(client: AsyncClient, ops_token: str):
    resp = await client.post("/accounts", json={
        "name": "X",
        "email": "x@test.com",
        "password": "pass1234",
        "role": "client",
        "account_type": "retail",
    }, headers=auth(ops_token))
    assert resp.status_code == 403


async def test_create_account_duplicate_email(client: AsyncClient, admin_token: str):
    payload = {
        "name": "Dup",
        "email": "dup@test.com",
        "password": "pass1234",
        "role": "client",
        "account_type": "retail",
    }
    await client.post("/accounts", json=payload, headers=auth(admin_token))
    resp = await client.post("/accounts", json=payload, headers=auth(admin_token))
    assert resp.status_code == 409


# ---------------------------------------------------------------------------
# GET /accounts
# ---------------------------------------------------------------------------

async def test_list_accounts_admin(
    client: AsyncClient, admin_token: str, db_session: AsyncSession
):
    await create_account(db_session, email="list1@test.com")
    await create_account(db_session, email="list2@test.com")
    resp = await client.get("/accounts", headers=auth(admin_token))
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    assert len(resp.json()) >= 2


async def test_list_accounts_ops(client: AsyncClient, ops_token: str):
    resp = await client.get("/accounts", headers=auth(ops_token))
    assert resp.status_code == 200


async def test_list_accounts_client_forbidden(
    client: AsyncClient, retail_client_token: str
):
    resp = await client.get("/accounts", headers=auth(retail_client_token))
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# GET /accounts/{id}
# ---------------------------------------------------------------------------

async def test_get_account_detail(
    client: AsyncClient, admin_token: str, db_session: AsyncSession
):
    account = await create_account(db_session, email="detail@test.com")
    resp = await client.get(f"/accounts/{account.id}", headers=auth(admin_token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == account.id
    assert body["email"] == account.email


async def test_get_account_not_found(client: AsyncClient, admin_token: str):
    resp = await client.get("/accounts/999999", headers=auth(admin_token))
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# PATCH /accounts/{id}/deactivate
# ---------------------------------------------------------------------------

async def test_deactivate_account_no_holdings(
    client: AsyncClient, admin_token: str, db_session: AsyncSession
):
    account = await create_account(db_session, email="deact@test.com")
    resp = await client.patch(f"/accounts/{account.id}/deactivate", headers=auth(admin_token))
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False


async def test_deactivate_account_with_token_balance_blocked(
    client: AsyncClient, admin_token: str, db_session: AsyncSession
):
    account = await create_account(db_session, email="rich@test.com")
    await create_token_balance(db_session, account_id=account.id, metal=Metal.gold, balance=500)
    resp = await client.patch(f"/accounts/{account.id}/deactivate", headers=auth(admin_token))
    assert resp.status_code == 409


async def test_deactivate_account_with_active_bars_blocked(
    client: AsyncClient, admin_token: str, db_session: AsyncSession
):
    account = await create_account(
        db_session, email="barowner@test.com",
        role=Role.client, account_type=AccountType.institutional
    )
    vault = await create_vault(db_session)
    deposit = await create_deposit(
        db_session,
        account_id=account.id,
        vault_id=vault.id,
        storage_type=StorageType.allocated,
        token_amount=None,
        created_by=account.id,
    )
    await create_allocated_bar(db_session, deposit_id=deposit.id)
    resp = await client.patch(f"/accounts/{account.id}/deactivate", headers=auth(admin_token))
    assert resp.status_code == 409


async def test_deactivate_non_admin_forbidden(
    client: AsyncClient, ops_token: str, db_session: AsyncSession
):
    account = await create_account(db_session, email="target@test.com")
    resp = await client.patch(f"/accounts/{account.id}/deactivate", headers=auth(ops_token))
    assert resp.status_code == 403
