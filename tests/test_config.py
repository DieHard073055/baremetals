"""
Task 9 — System Config tests (TDD: written before implementation).

Covers:
  GET  /config          all authenticated roles → 200 with defaults
  PATCH /config         admin → 200, reflected in next read
                        non-admin → 403
"""
from httpx import AsyncClient


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def test_get_config_returns_defaults(client: AsyncClient, admin_token: str):
    resp = await client.get("/config", headers=auth(admin_token))
    assert resp.status_code == 200
    body = resp.json()
    assert "mvr_usd_rate" in body
    assert "price_cache_ttl_hours" in body
    assert abs(float(body["mvr_usd_rate"]) - 15.42) < 0.001
    assert int(body["price_cache_ttl_hours"]) == 24


async def test_get_config_ops_allowed(client: AsyncClient, ops_token: str):
    resp = await client.get("/config", headers=auth(ops_token))
    assert resp.status_code == 200


async def test_get_config_client_allowed(client: AsyncClient, retail_client_token: str):
    resp = await client.get("/config", headers=auth(retail_client_token))
    assert resp.status_code == 200


async def test_patch_config_updates_mvr_rate(client: AsyncClient, admin_token: str):
    resp = await client.patch("/config", json={"mvr_usd_rate": 15.99}, headers=auth(admin_token))
    assert resp.status_code == 200
    assert abs(float(resp.json()["mvr_usd_rate"]) - 15.99) < 0.001

    # Verify the change is reflected on next read
    resp2 = await client.get("/config", headers=auth(admin_token))
    assert abs(float(resp2.json()["mvr_usd_rate"]) - 15.99) < 0.001


async def test_patch_config_updates_ttl(client: AsyncClient, admin_token: str):
    resp = await client.patch("/config", json={"price_cache_ttl_hours": 12}, headers=auth(admin_token))
    assert resp.status_code == 200
    assert int(resp.json()["price_cache_ttl_hours"]) == 12


async def test_patch_config_non_admin_forbidden(client: AsyncClient, ops_token: str):
    resp = await client.patch("/config", json={"mvr_usd_rate": 99.0}, headers=auth(ops_token))
    assert resp.status_code == 403
