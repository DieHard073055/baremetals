from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.database import AsyncSessionLocal
from app import seed


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with AsyncSessionLocal() as session:
        await seed.run(session)
    yield


app = FastAPI(title="Bare Metals API", lifespan=lifespan)


@app.get("/health")
async def health():
    return {"status": "ok"}
