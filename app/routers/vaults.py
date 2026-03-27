from fastapi import APIRouter, Depends

from app.deps import require_admin
from app.models.account import Account

router = APIRouter(prefix="/vaults", tags=["vaults"])


@router.post("")
async def create_vault(_: Account = Depends(require_admin)):
    # Implemented in Task 4
    pass  # pragma: no cover
