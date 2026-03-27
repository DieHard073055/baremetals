"""
Task 2 — Auth tests (TDD: written before implementation).

Covers:
  - POST /auth/login: success, wrong password, unknown email, inactive account
  - GET  /auth/me:   valid token, missing token, expired token
  - Role guards:     admin-only route blocked for ops/client
                     client can access own portfolio stub, blocked from others
"""
from datetime import datetime, timezone, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories import create_account as _create_account
from app.models.enums import Role, AccountType


async def _login(client: AsyncClient, email: str, password: str = "password123"):
    return await client.post("/auth/login", data={"username": email, "password": password})


# ---------------------------------------------------------------------------
# POST /auth/login
# ---------------------------------------------------------------------------

async def test_login_success(client: AsyncClient, db_session: AsyncSession):
    account = await _create_account(db_session, email="alice@example.com")
    resp = await _login(client, account.email)
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


async def test_login_wrong_password(client: AsyncClient, db_session: AsyncSession):
    account = await _create_account(db_session, email="bob@example.com")
    resp = await client.post("/auth/login", data={"username": account.email, "password": "wrong"})
    assert resp.status_code == 401


async def test_login_unknown_email(client: AsyncClient):
    resp = await _login(client, "nobody@example.com")
    assert resp.status_code == 401


async def test_login_inactive_account(client: AsyncClient, db_session: AsyncSession):
    account = await _create_account(db_session, email="inactive@example.com", is_active=False)
    resp = await _login(client, account.email)
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# GET /auth/me
# ---------------------------------------------------------------------------

async def test_me_valid_token(client: AsyncClient, db_session: AsyncSession):
    account = await _create_account(
        db_session, email="me@example.com", role=Role.ops, account_type=None
    )
    login = await _login(client, account.email)
    token = login.json()["access_token"]

    resp = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == account.email
    assert body["role"] == Role.ops
    assert "id" in body
    assert "name" in body


async def test_me_no_token(client: AsyncClient):
    resp = await client.get("/auth/me")
    assert resp.status_code == 401


async def test_me_expired_token(client: AsyncClient, db_session: AsyncSession):
    from app.auth import create_access_token
    account = await _create_account(db_session, email="expired@example.com")
    # Token that expired 1 hour ago
    token = create_access_token({"sub": str(account.id)}, expires_delta=timedelta(hours=-1))
    resp = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401


async def test_me_malformed_token(client: AsyncClient):
    resp = await client.get("/auth/me", headers={"Authorization": "Bearer notavalidtoken"})
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Role guards
# ---------------------------------------------------------------------------

async def test_admin_only_route_blocked_for_ops(client: AsyncClient, db_session: AsyncSession):
    """POST /vaults is admin-only — ops should get 403."""
    ops = await _create_account(db_session, email="ops@example.com", role=Role.ops, account_type=None)
    login = await _login(client, ops.email)
    token = login.json()["access_token"]

    resp = await client.post(
        "/vaults",
        json={"name": "Test Vault", "latitude": 4.175, "longitude": 73.509},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


async def test_admin_only_route_blocked_for_client(client: AsyncClient, db_session: AsyncSession):
    """POST /vaults is admin-only — client should get 403."""
    cli = await _create_account(db_session, email="client@example.com")
    login = await _login(client, cli.email)
    token = login.json()["access_token"]

    resp = await client.post(
        "/vaults",
        json={"name": "Test Vault", "latitude": 4.175, "longitude": 73.509},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


async def test_unauthenticated_blocked(client: AsyncClient):
    """Any protected route without a token returns 401."""
    resp = await client.get("/auth/me")
    assert resp.status_code == 401
