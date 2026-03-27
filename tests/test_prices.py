"""
Task 8 — Metal Prices tests (TDD: written before implementation).

Covers:
  GET  /prices         cache within TTL → no external call
                       cache expired → fetch + persist
                       API unreachable + cache → stale: true
                       API unreachable + no cache → 503
  POST /prices/refresh admin → 200, non-admin → 403
"""
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import Metal
from tests.factories import create_metal_price


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


_MOCK_PRICES = {
    Metal.gold: 1960.0,
    Metal.silver: 24.5,
    Metal.platinum: 980.0,
}


# ---------------------------------------------------------------------------
# GET /prices
# ---------------------------------------------------------------------------

async def test_prices_served_from_cache_within_ttl(
    client: AsyncClient, admin_token: str, db_session: AsyncSession
):
    """Fresh cache — external API must NOT be called."""
    await create_metal_price(db_session, Metal.gold, 1960.0)

    not_called = AsyncMock(side_effect=Exception("fetch_prices should not be called"))
    with patch("app.price_client.fetch_prices", not_called):
        resp = await client.get("/prices", headers=auth(admin_token))

    assert resp.status_code == 200
    not_called.assert_not_called()
    gold = next(p for p in resp.json() if p["metal"] == "gold")
    assert abs(gold["price_usd_per_troy_oz"] - 1960.0) < 0.01
    assert gold["stale"] is False


async def test_prices_fetched_when_cache_expired(
    client: AsyncClient, admin_token: str, db_session: AsyncSession
):
    """Expired cache — external API SHOULD be called and DB updated."""
    old_time = datetime.now(timezone.utc) - timedelta(hours=48)
    await create_metal_price(db_session, Metal.gold, 1800.0, fetched_at=old_time)

    mock_fetch = AsyncMock(return_value=_MOCK_PRICES)
    with patch("app.price_client.fetch_prices", mock_fetch):
        resp = await client.get("/prices", headers=auth(admin_token))

    assert resp.status_code == 200
    mock_fetch.assert_called_once()
    gold = next(p for p in resp.json() if p["metal"] == "gold")
    assert abs(gold["price_usd_per_troy_oz"] - 1960.0) < 0.01
    assert gold["stale"] is False


async def test_prices_stale_when_api_unreachable_cache_exists(
    client: AsyncClient, admin_token: str, db_session: AsyncSession
):
    """Expired cache + API unreachable → serve last cache with stale=true."""
    import httpx
    old_time = datetime.now(timezone.utc) - timedelta(hours=48)
    await create_metal_price(db_session, Metal.gold, 1800.0, fetched_at=old_time)

    mock_fetch = AsyncMock(side_effect=httpx.ConnectError("unreachable"))
    with patch("app.price_client.fetch_prices", mock_fetch):
        resp = await client.get("/prices", headers=auth(admin_token))

    assert resp.status_code == 200
    gold = next(p for p in resp.json() if p["metal"] == "gold")
    assert gold["stale"] is True
    assert abs(gold["price_usd_per_troy_oz"] - 1800.0) < 0.01


async def test_prices_503_when_api_unreachable_no_cache(
    client: AsyncClient, admin_token: str
):
    """No cache at all + API unreachable → 503."""
    import httpx
    mock_fetch = AsyncMock(side_effect=httpx.ConnectError("unreachable"))
    with patch("app.price_client.fetch_prices", mock_fetch):
        resp = await client.get("/prices", headers=auth(admin_token))

    assert resp.status_code == 503


# ---------------------------------------------------------------------------
# POST /prices/refresh
# ---------------------------------------------------------------------------

async def test_force_refresh_admin(
    client: AsyncClient, admin_token: str, db_session: AsyncSession
):
    mock_fetch = AsyncMock(return_value=_MOCK_PRICES)
    with patch("app.price_client.fetch_prices", mock_fetch):
        resp = await client.post("/prices/refresh", headers=auth(admin_token))

    assert resp.status_code == 200
    mock_fetch.assert_called_once()
    gold = next(p for p in resp.json() if p["metal"] == "gold")
    assert abs(gold["price_usd_per_troy_oz"] - 1960.0) < 0.01


async def test_force_refresh_non_admin_forbidden(
    client: AsyncClient, ops_token: str
):
    resp = await client.post("/prices/refresh", headers=auth(ops_token))
    assert resp.status_code == 403
