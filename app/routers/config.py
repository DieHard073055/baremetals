from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, require_admin
from app.models.account import Account
from app.models.system_config import SystemConfig

router = APIRouter(prefix="/config", tags=["config"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ConfigResponse(BaseModel):
    mvr_usd_rate: float
    price_cache_ttl_hours: int


class ConfigPatch(BaseModel):
    mvr_usd_rate: float | None = None
    price_cache_ttl_hours: int | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_config_map(db: AsyncSession) -> dict[str, str]:
    result = await db.execute(select(SystemConfig))
    return {row.key: row.value for row in result.scalars().all()}


async def _to_response(cfg: dict[str, str]) -> ConfigResponse:
    return ConfigResponse(
        mvr_usd_rate=float(cfg.get("mvr_usd_rate", "15.42")),
        price_cache_ttl_hours=int(cfg.get("price_cache_ttl_hours", "24")),
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("", response_model=ConfigResponse)
async def get_config(
    db: AsyncSession = Depends(get_db),
    _: Account = Depends(get_current_user),
):
    cfg = await _get_config_map(db)
    return await _to_response(cfg)


@router.patch("", response_model=ConfigResponse)
async def patch_config(
    body: ConfigPatch,
    db: AsyncSession = Depends(get_db),
    _: Account = Depends(require_admin),
):
    updates: dict[str, str] = {}
    if body.mvr_usd_rate is not None:
        updates["mvr_usd_rate"] = str(body.mvr_usd_rate)
    if body.price_cache_ttl_hours is not None:
        updates["price_cache_ttl_hours"] = str(body.price_cache_ttl_hours)

    for key, value in updates.items():
        result = await db.execute(select(SystemConfig).where(SystemConfig.key == key))
        row = result.scalar_one_or_none()
        if row is None:
            db.add(SystemConfig(key=key, value=value))
        else:
            row.value = value
    await db.flush()

    cfg = await _get_config_map(db)
    return await _to_response(cfg)
