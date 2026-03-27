import asyncio
import os

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

import app.models  # noqa: F401 — register all models with Base
from app.database import Base, get_db
from app.main import app

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://postgres:baremetals@localhost:5432/baremetals_test",
)

# NullPool: no connection reuse across event loops — each connect() is fresh.
test_engine = create_async_engine(TEST_DATABASE_URL, echo=False, poolclass=NullPool)
TestSessionLocal = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


# ---------------------------------------------------------------------------
# Create / drop tables once per session (sync wrapper around async ops)
# ---------------------------------------------------------------------------

def _run(coro):
    """Run a coroutine synchronously in a temporary event loop."""
    return asyncio.run(coro)


@pytest.fixture(scope="session", autouse=True)
def create_tables():
    async def _create():
        async with test_engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)

    async def _drop():
        async with test_engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)

    _run(_create())
    yield
    _run(_drop())


# ---------------------------------------------------------------------------
# Per-test DB session — function-scoped, lives entirely in the test's loop
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def db_session():
    async with TestSessionLocal() as session:
        yield session
        await session.rollback()


# ---------------------------------------------------------------------------
# HTTP test client wired to the test DB session
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def client(db_session: AsyncSession):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Role token fixtures — implemented in Task 2 (Auth)
# ---------------------------------------------------------------------------

@pytest.fixture
def admin_token():
    pytest.skip("Auth not yet implemented — available after Task 2")


@pytest.fixture
def ops_token():
    pytest.skip("Auth not yet implemented — available after Task 2")


@pytest.fixture
def retail_client_token():
    pytest.skip("Auth not yet implemented — available after Task 2")


@pytest.fixture
def institutional_client_token():
    pytest.skip("Auth not yet implemented — available after Task 2")
