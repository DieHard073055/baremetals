"""
Thin HTTP client for metalpriceapi.com.

Returns prices as {Metal: USD per troy oz}.
Raises httpx.HTTPError / httpx.ConnectError on network failure.
"""
import httpx

from app.config import settings
from app.models.enums import Metal


async def fetch_prices() -> dict[Metal, float]:
    """
    Call metalpriceapi.com and return {Metal: price_usd_per_troy_oz}.

    The API returns rates relative to USD (base=USD):
      rates["XAU"] = amount of XAU per 1 USD  → price = 1 / rate
    """
    url = (
        "https://api.metalpriceapi.com/v1/latest"
        f"?api_key={settings.metal_price_api_key}"
        "&base=USD&currencies=XAU,XAG,XPT"
    )
    async with httpx.AsyncClient(timeout=10.0) as http:
        resp = await http.get(url)
        resp.raise_for_status()
        data = resp.json()

    rates = data["rates"]
    return {
        Metal.gold: round(1.0 / rates["XAU"], 4),
        Metal.silver: round(1.0 / rates["XAG"], 4),
        Metal.platinum: round(1.0 / rates["XPT"], 4),
    }
