from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.database import AsyncSessionLocal
from app import seed
from app.routers import auth, accounts, vaults, deposits, withdrawals, portfolio, prices, config


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with AsyncSessionLocal() as session:
        await seed.run(session)
    yield


app = FastAPI(title="Bare Metals API", lifespan=lifespan)

app.include_router(auth.router)
app.include_router(accounts.router)
app.include_router(vaults.router)
app.include_router(deposits.router)
app.include_router(withdrawals.router)
app.include_router(portfolio.router)
app.include_router(prices.router)
app.include_router(config.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
