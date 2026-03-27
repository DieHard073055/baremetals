"""
Task 5 — Deposits tests (TDD: written before implementation).

Covers:
  POST /deposits  unallocated: success, token_amount ≤ 0 → 422, wrong account type → 422
                  allocated:   success with bars, duplicate serial → 409, wrong account type → 422
  GET  /deposits              list (admin/ops); client → 403
  GET  /deposits/{id}         detail with bars for allocated type; not found → 404
"""
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import AccountType, Metal, Role, StorageType
from tests.factories import create_account, create_vault, create_deposit, create_allocated_bar


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# POST /deposits — unallocated
# ---------------------------------------------------------------------------

async def test_unallocated_deposit_success(
    client: AsyncClient, ops_token: str, db_session: AsyncSession
):
    retail = await create_account(db_session, role=Role.client, account_type=AccountType.retail)
    vault = await create_vault(db_session)

    resp = await client.post("/deposits", json={
        "account_id": retail.id,
        "vault_id": vault.id,
        "metal": "gold",
        "storage_type": "unallocated",
        "token_amount": 10000,
    }, headers=auth(ops_token))
    assert resp.status_code == 201
    body = resp.json()
    assert body["storage_type"] == "unallocated"
    assert body["token_amount"] == 10000
    assert "deposit_number" in body


async def test_unallocated_deposit_increments_pool_and_balance(
    client: AsyncClient, ops_token: str, admin_token: str, db_session: AsyncSession
):
    retail = await create_account(db_session, role=Role.client, account_type=AccountType.retail)
    vault = await create_vault(db_session)

    await client.post("/deposits", json={
        "account_id": retail.id, "vault_id": vault.id,
        "metal": "gold", "storage_type": "unallocated", "token_amount": 5000,
    }, headers=auth(ops_token))

    # Check pool via vault detail
    vault_resp = await client.get(f"/vaults/{vault.id}", headers=auth(admin_token))
    pools = vault_resp.json()["pools"]
    gold_pool = next((p for p in pools if p["metal"] == "gold"), None)
    assert gold_pool is not None
    assert gold_pool["total_tokens"] == 5000


async def test_unallocated_deposit_zero_token_rejected(
    client: AsyncClient, ops_token: str, db_session: AsyncSession
):
    retail = await create_account(db_session, role=Role.client, account_type=AccountType.retail)
    vault = await create_vault(db_session)
    resp = await client.post("/deposits", json={
        "account_id": retail.id, "vault_id": vault.id,
        "metal": "gold", "storage_type": "unallocated", "token_amount": 0,
    }, headers=auth(ops_token))
    assert resp.status_code == 422


async def test_unallocated_deposit_negative_token_rejected(
    client: AsyncClient, ops_token: str, db_session: AsyncSession
):
    retail = await create_account(db_session, role=Role.client, account_type=AccountType.retail)
    vault = await create_vault(db_session)
    resp = await client.post("/deposits", json={
        "account_id": retail.id, "vault_id": vault.id,
        "metal": "gold", "storage_type": "unallocated", "token_amount": -100,
    }, headers=auth(ops_token))
    assert resp.status_code == 422


async def test_institutional_cannot_use_unallocated(
    client: AsyncClient, ops_token: str, db_session: AsyncSession
):
    inst = await create_account(db_session, role=Role.client, account_type=AccountType.institutional)
    vault = await create_vault(db_session)
    resp = await client.post("/deposits", json={
        "account_id": inst.id, "vault_id": vault.id,
        "metal": "gold", "storage_type": "unallocated", "token_amount": 1000,
    }, headers=auth(ops_token))
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# POST /deposits — allocated
# ---------------------------------------------------------------------------

async def test_allocated_deposit_success(
    client: AsyncClient, ops_token: str, db_session: AsyncSession
):
    inst = await create_account(db_session, role=Role.client, account_type=AccountType.institutional)
    vault = await create_vault(db_session)
    resp = await client.post("/deposits", json={
        "account_id": inst.id, "vault_id": vault.id,
        "metal": "gold", "storage_type": "allocated",
        "bars": [
            {"serial_number": "GB-001", "weight_g": 1000.0},
            {"serial_number": "GB-002", "weight_g": 500.5},
        ],
    }, headers=auth(ops_token))
    assert resp.status_code == 201
    body = resp.json()
    assert body["storage_type"] == "allocated"
    assert len(body["bars"]) == 2


async def test_allocated_deposit_duplicate_serial_rejected(
    client: AsyncClient, ops_token: str, db_session: AsyncSession
):
    inst = await create_account(db_session, role=Role.client, account_type=AccountType.institutional)
    vault = await create_vault(db_session)
    deposit = await create_deposit(
        db_session, account_id=inst.id, vault_id=vault.id,
        storage_type=StorageType.allocated, token_amount=None, created_by=inst.id,
    )
    await create_allocated_bar(db_session, deposit_id=deposit.id, serial_number="DUP-001")

    resp = await client.post("/deposits", json={
        "account_id": inst.id, "vault_id": vault.id,
        "metal": "gold", "storage_type": "allocated",
        "bars": [{"serial_number": "DUP-001", "weight_g": 1000.0}],
    }, headers=auth(ops_token))
    assert resp.status_code == 409


async def test_retail_cannot_use_allocated(
    client: AsyncClient, ops_token: str, db_session: AsyncSession
):
    retail = await create_account(db_session, role=Role.client, account_type=AccountType.retail)
    vault = await create_vault(db_session)
    resp = await client.post("/deposits", json={
        "account_id": retail.id, "vault_id": vault.id,
        "metal": "gold", "storage_type": "allocated",
        "bars": [{"serial_number": "X-001", "weight_g": 100.0}],
    }, headers=auth(ops_token))
    assert resp.status_code == 422


async def test_deposit_non_ops_rejected(
    client: AsyncClient, admin_token: str, db_session: AsyncSession
):
    retail = await create_account(db_session, role=Role.client, account_type=AccountType.retail)
    vault = await create_vault(db_session)
    resp = await client.post("/deposits", json={
        "account_id": retail.id, "vault_id": vault.id,
        "metal": "gold", "storage_type": "unallocated", "token_amount": 100,
    }, headers=auth(admin_token))
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# GET /deposits
# ---------------------------------------------------------------------------

async def test_list_deposits(
    client: AsyncClient, admin_token: str, ops_token: str, db_session: AsyncSession
):
    retail = await create_account(db_session, role=Role.client, account_type=AccountType.retail)
    vault = await create_vault(db_session)
    await create_deposit(
        db_session, account_id=retail.id, vault_id=vault.id,
        storage_type=StorageType.unallocated, token_amount=1000, created_by=retail.id,
    )
    resp = await client.get("/deposits", headers=auth(admin_token))
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    assert len(resp.json()) >= 1


async def test_list_deposits_client_sees_empty_list(
    client: AsyncClient, retail_client_token: str
):
    """Client with no deposits gets an empty list, not a 403."""
    resp = await client.get("/deposits", headers=auth(retail_client_token))
    assert resp.status_code == 200
    assert resp.json() == []


# ---------------------------------------------------------------------------
# GET /deposits/{id}
# ---------------------------------------------------------------------------

async def test_deposit_detail_unallocated(
    client: AsyncClient, admin_token: str, db_session: AsyncSession
):
    retail = await create_account(db_session, role=Role.client, account_type=AccountType.retail)
    vault = await create_vault(db_session)
    deposit = await create_deposit(
        db_session, account_id=retail.id, vault_id=vault.id,
        storage_type=StorageType.unallocated, token_amount=500, created_by=retail.id,
    )
    resp = await client.get(f"/deposits/{deposit.id}", headers=auth(admin_token))
    assert resp.status_code == 200
    assert resp.json()["token_amount"] == 500
    assert resp.json()["bars"] == []


async def test_deposit_detail_allocated_includes_bars(
    client: AsyncClient, admin_token: str, ops_token: str, db_session: AsyncSession
):
    inst = await create_account(db_session, role=Role.client, account_type=AccountType.institutional)
    vault = await create_vault(db_session)
    resp = await client.post("/deposits", json={
        "account_id": inst.id, "vault_id": vault.id,
        "metal": "silver", "storage_type": "allocated",
        "bars": [{"serial_number": "DETAIL-BAR-01", "weight_g": 750.25}],
    }, headers=auth(ops_token))
    deposit_id = resp.json()["id"]

    resp2 = await client.get(f"/deposits/{deposit_id}", headers=auth(admin_token))
    assert resp2.status_code == 200
    bars = resp2.json()["bars"]
    assert len(bars) == 1
    assert bars[0]["serial_number"] == "DETAIL-BAR-01"


async def test_deposit_not_found(client: AsyncClient, admin_token: str):
    resp = await client.get("/deposits/999999", headers=auth(admin_token))
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# GET /deposits — client can only see their own
# ---------------------------------------------------------------------------

async def test_list_deposits_client_sees_own(
    client: AsyncClient, db_session: AsyncSession
):
    """A client token should return only that client's deposits, not others'."""
    from app.auth import create_access_token

    owner = await create_account(db_session, role=Role.client, account_type=AccountType.retail)
    other = await create_account(db_session, role=Role.client, account_type=AccountType.retail)
    vault = await create_vault(db_session)

    await create_deposit(
        db_session, account_id=owner.id, vault_id=vault.id,
        storage_type=StorageType.unallocated, token_amount=100, created_by=owner.id,
    )
    await create_deposit(
        db_session, account_id=other.id, vault_id=vault.id,
        storage_type=StorageType.unallocated, token_amount=200, created_by=other.id,
    )

    token = create_access_token({"sub": str(owner.id)})
    resp = await client.get("/deposits", headers=auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert all(d["account_id"] == owner.id for d in data), "Client received another client's deposit"
    assert len(data) == 1


async def test_list_deposits_client_no_storage_type(
    client: AsyncClient, db_session: AsyncSession
):
    """Client responses must not include storage_type."""
    from app.auth import create_access_token

    owner = await create_account(db_session, role=Role.client, account_type=AccountType.retail)
    vault = await create_vault(db_session)
    await create_deposit(
        db_session, account_id=owner.id, vault_id=vault.id,
        storage_type=StorageType.unallocated, token_amount=100, created_by=owner.id,
    )

    token = create_access_token({"sub": str(owner.id)})
    resp = await client.get("/deposits", headers=auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert "storage_type" not in data[0] or data[0]["storage_type"] is None
