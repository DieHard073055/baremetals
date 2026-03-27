"""
Task 6 — Withdrawals tests (TDD: written before implementation).

Covers:
  POST /withdrawals  unallocated: success, insufficient balance → 422,
                                  insufficient pool → 422
                     allocated:   success, wrong account bar → 422,
                                  already withdrawn bar → 422
  GET  /withdrawals               list (admin/ops); client → 403
"""
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import AccountType, Metal, Role, StorageType
from tests.factories import (
    create_account,
    create_allocated_bar,
    create_deposit,
    create_token_balance,
    create_unallocated_pool,
    create_vault,
    create_withdrawal,
    WithdrawalBarFactory,
)


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _setup_retail(db: AsyncSession, tokens: int = 10000):
    """Create retail client, vault, pool, and token balance ready for withdrawal."""
    retail = await create_account(db, role=Role.client, account_type=AccountType.retail)
    vault = await create_vault(db)
    await create_unallocated_pool(db, vault_id=vault.id, metal=Metal.gold, total_tokens=tokens)
    await create_token_balance(db, account_id=retail.id, metal=Metal.gold, balance=tokens)
    return retail, vault


# ---------------------------------------------------------------------------
# POST /withdrawals — unallocated
# ---------------------------------------------------------------------------

async def test_unallocated_withdrawal_success(
    client: AsyncClient, ops_token: str, db_session: AsyncSession
):
    retail, vault = await _setup_retail(db_session, tokens=5000)
    resp = await client.post("/withdrawals", json={
        "account_id": retail.id,
        "vault_id": vault.id,
        "metal": "gold",
        "storage_type": "unallocated",
        "token_amount": 2000,
    }, headers=auth(ops_token))
    assert resp.status_code == 201
    assert resp.json()["token_amount"] == 2000


async def test_unallocated_withdrawal_decrements_balance_and_pool(
    client: AsyncClient, ops_token: str, admin_token: str, db_session: AsyncSession
):
    retail, vault = await _setup_retail(db_session, tokens=8000)
    await client.post("/withdrawals", json={
        "account_id": retail.id, "vault_id": vault.id,
        "metal": "gold", "storage_type": "unallocated", "token_amount": 3000,
    }, headers=auth(ops_token))

    vault_resp = await client.get(f"/vaults/{vault.id}", headers=auth(admin_token))
    gold_pool = next(p for p in vault_resp.json()["pools"] if p["metal"] == "gold")
    assert gold_pool["total_tokens"] == 5000


async def test_unallocated_withdrawal_insufficient_balance(
    client: AsyncClient, ops_token: str, db_session: AsyncSession
):
    retail, vault = await _setup_retail(db_session, tokens=100)
    resp = await client.post("/withdrawals", json={
        "account_id": retail.id, "vault_id": vault.id,
        "metal": "gold", "storage_type": "unallocated", "token_amount": 200,
    }, headers=auth(ops_token))
    assert resp.status_code == 422


async def test_unallocated_withdrawal_insufficient_pool(
    client: AsyncClient, ops_token: str, db_session: AsyncSession
):
    """Client balance OK but vault pool has fewer tokens."""
    retail = await create_account(db_session, role=Role.client, account_type=AccountType.retail)
    vault = await create_vault(db_session)
    # Pool only has 100 but client balance says 500
    await create_unallocated_pool(db_session, vault_id=vault.id, metal=Metal.gold, total_tokens=100)
    await create_token_balance(db_session, account_id=retail.id, metal=Metal.gold, balance=500)

    resp = await client.post("/withdrawals", json={
        "account_id": retail.id, "vault_id": vault.id,
        "metal": "gold", "storage_type": "unallocated", "token_amount": 200,
    }, headers=auth(ops_token))
    assert resp.status_code == 422


async def test_withdrawal_non_ops_rejected(
    client: AsyncClient, admin_token: str, db_session: AsyncSession
):
    retail, vault = await _setup_retail(db_session, tokens=1000)
    resp = await client.post("/withdrawals", json={
        "account_id": retail.id, "vault_id": vault.id,
        "metal": "gold", "storage_type": "unallocated", "token_amount": 100,
    }, headers=auth(admin_token))
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# POST /withdrawals — allocated
# ---------------------------------------------------------------------------

async def test_allocated_withdrawal_success(
    client: AsyncClient, ops_token: str, db_session: AsyncSession
):
    inst = await create_account(db_session, role=Role.client, account_type=AccountType.institutional)
    vault = await create_vault(db_session)
    deposit = await create_deposit(
        db_session, account_id=inst.id, vault_id=vault.id,
        storage_type=StorageType.allocated, token_amount=None, created_by=inst.id,
    )
    bar = await create_allocated_bar(db_session, deposit_id=deposit.id, serial_number="W-001")

    resp = await client.post("/withdrawals", json={
        "account_id": inst.id,
        "storage_type": "allocated",
        "bar_ids": [bar.id],
    }, headers=auth(ops_token))
    assert resp.status_code == 201


async def test_allocated_withdrawal_bar_wrong_account_rejected(
    client: AsyncClient, ops_token: str, db_session: AsyncSession
):
    inst1 = await create_account(db_session, role=Role.client, account_type=AccountType.institutional)
    inst2 = await create_account(db_session, role=Role.client, account_type=AccountType.institutional)
    vault = await create_vault(db_session)
    deposit = await create_deposit(
        db_session, account_id=inst1.id, vault_id=vault.id,
        storage_type=StorageType.allocated, token_amount=None, created_by=inst1.id,
    )
    bar = await create_allocated_bar(db_session, deposit_id=deposit.id, serial_number="W-WRONG-001")

    # inst2 tries to withdraw inst1's bar
    resp = await client.post("/withdrawals", json={
        "account_id": inst2.id, "storage_type": "allocated", "bar_ids": [bar.id],
    }, headers=auth(ops_token))
    assert resp.status_code == 422


async def test_allocated_withdrawal_already_withdrawn_rejected(
    client: AsyncClient, ops_token: str, db_session: AsyncSession
):
    inst = await create_account(db_session, role=Role.client, account_type=AccountType.institutional)
    vault = await create_vault(db_session)
    deposit = await create_deposit(
        db_session, account_id=inst.id, vault_id=vault.id,
        storage_type=StorageType.allocated, token_amount=None, created_by=inst.id,
    )
    bar = await create_allocated_bar(db_session, deposit_id=deposit.id, serial_number="W-USED-001")

    # First withdrawal succeeds
    await client.post("/withdrawals", json={
        "account_id": inst.id, "storage_type": "allocated", "bar_ids": [bar.id],
    }, headers=auth(ops_token))

    # Second withdrawal of same bar is rejected
    resp = await client.post("/withdrawals", json={
        "account_id": inst.id, "storage_type": "allocated", "bar_ids": [bar.id],
    }, headers=auth(ops_token))
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /withdrawals
# ---------------------------------------------------------------------------

async def test_list_withdrawals_admin(
    client: AsyncClient, admin_token: str, db_session: AsyncSession
):
    retail = await create_account(db_session, role=Role.client, account_type=AccountType.retail)
    vault = await create_vault(db_session)
    await create_withdrawal(
        db_session, account_id=retail.id, vault_id=vault.id,
        metal=Metal.gold, storage_type=StorageType.unallocated,
        token_amount=100, created_by=retail.id,
    )
    resp = await client.get("/withdrawals", headers=auth(admin_token))
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


async def test_list_withdrawals_client_sees_empty_list(
    client: AsyncClient, retail_client_token: str
):
    """Client with no withdrawals gets an empty list, not a 403."""
    resp = await client.get("/withdrawals", headers=auth(retail_client_token))
    assert resp.status_code == 200
    assert resp.json() == []


# ---------------------------------------------------------------------------
# GET /withdrawals — client can only see their own
# ---------------------------------------------------------------------------

async def test_list_withdrawals_client_sees_own(
    client: AsyncClient, db_session: AsyncSession
):
    """A client token should return only that client's withdrawals, not others'."""
    from app.auth import create_access_token

    owner = await create_account(db_session, role=Role.client, account_type=AccountType.retail)
    other = await create_account(db_session, role=Role.client, account_type=AccountType.retail)
    vault = await create_vault(db_session)

    await create_withdrawal(
        db_session, account_id=owner.id, vault_id=vault.id,
        metal=Metal.gold, storage_type=StorageType.unallocated,
        token_amount=50, created_by=owner.id,
    )
    await create_withdrawal(
        db_session, account_id=other.id, vault_id=vault.id,
        metal=Metal.gold, storage_type=StorageType.unallocated,
        token_amount=75, created_by=other.id,
    )

    token = create_access_token({"sub": str(owner.id)})
    resp = await client.get("/withdrawals", headers=auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert all(w["account_id"] == owner.id for w in data), "Client received another client's withdrawal"
    assert len(data) == 1


async def test_list_withdrawals_client_no_storage_type(
    client: AsyncClient, db_session: AsyncSession
):
    """Client responses must not include storage_type."""
    from app.auth import create_access_token

    owner = await create_account(db_session, role=Role.client, account_type=AccountType.retail)
    vault = await create_vault(db_session)
    await create_withdrawal(
        db_session, account_id=owner.id, vault_id=vault.id,
        metal=Metal.gold, storage_type=StorageType.unallocated,
        token_amount=50, created_by=owner.id,
    )

    token = create_access_token({"sub": str(owner.id)})
    resp = await client.get("/withdrawals", headers=auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert "storage_type" not in data[0] or data[0]["storage_type"] is None
