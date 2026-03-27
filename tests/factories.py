"""
Factories for test data.

Each factory builds a model instance in memory (factory.Factory).
Each async `create_*` function adds the instance to the session and flushes
(gets the DB-assigned ID without committing, preserving per-test rollback).
"""
import bcrypt
import factory
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account
from app.models.deposit import AllocatedBar, Deposit, TokenBalance
from app.models.enums import AccountType, Metal, Role, StorageType
from app.models.metal_price import MetalPrice
from app.models.vault import UnallocatedPool, Vault
from app.models.withdrawal import Withdrawal, WithdrawalBar

# Pre-hashed "password123" — computed once to avoid per-factory bcrypt overhead
DEFAULT_PASSWORD = "password123"
_DEFAULT_HASH = bcrypt.hashpw(DEFAULT_PASSWORD.encode(), bcrypt.gensalt()).decode()


# ---------------------------------------------------------------------------
# In-memory builders (no DB interaction)
# ---------------------------------------------------------------------------

class AccountFactory(factory.Factory):
    class Meta:
        model = Account

    name = factory.Faker("name")
    email = factory.Sequence(lambda n: f"user{n}@example.com")
    password_hash = _DEFAULT_HASH
    role = Role.client
    account_type = AccountType.retail
    is_active = True
    created_by = None


class VaultFactory(factory.Factory):
    class Meta:
        model = Vault

    name = factory.Sequence(lambda n: f"Vault {n}")
    latitude = factory.Faker("latitude")
    longitude = factory.Faker("longitude")
    is_active = True
    created_by = None


class DepositFactory(factory.Factory):
    class Meta:
        model = Deposit

    deposit_number = factory.Sequence(lambda n: f"DEP-{n:06d}")
    account_id = None
    vault_id = None
    metal = Metal.gold
    storage_type = StorageType.unallocated
    token_amount = 10000  # 1 kg
    created_by = None


class AllocatedBarFactory(factory.Factory):
    class Meta:
        model = AllocatedBar

    deposit_id = None
    serial_number = factory.Sequence(lambda n: f"BAR-{n:06d}")
    weight_g = 1000.0


class TokenBalanceFactory(factory.Factory):
    class Meta:
        model = TokenBalance

    account_id = None
    metal = Metal.gold
    balance = 0


class UnallocatedPoolFactory(factory.Factory):
    class Meta:
        model = UnallocatedPool

    vault_id = None
    metal = Metal.gold
    total_tokens = 0


class WithdrawalFactory(factory.Factory):
    class Meta:
        model = Withdrawal

    account_id = None
    vault_id = None
    metal = Metal.gold
    storage_type = StorageType.unallocated
    token_amount = 1000
    created_by = None


class WithdrawalBarFactory(factory.Factory):
    class Meta:
        model = WithdrawalBar

    withdrawal_id = None
    bar_id = None


# ---------------------------------------------------------------------------
# Async create helpers — add to session and flush (no commit)
# ---------------------------------------------------------------------------

async def create_account(session: AsyncSession, **kwargs) -> Account:
    obj = AccountFactory.build(**kwargs)
    session.add(obj)
    await session.flush()
    return obj


async def create_vault(session: AsyncSession, **kwargs) -> Vault:
    obj = VaultFactory.build(**kwargs)
    session.add(obj)
    await session.flush()
    return obj


async def create_deposit(session: AsyncSession, **kwargs) -> Deposit:
    obj = DepositFactory.build(**kwargs)
    session.add(obj)
    await session.flush()
    return obj


async def create_allocated_bar(session: AsyncSession, **kwargs) -> AllocatedBar:
    obj = AllocatedBarFactory.build(**kwargs)
    session.add(obj)
    await session.flush()
    return obj


async def create_token_balance(session: AsyncSession, **kwargs) -> TokenBalance:
    obj = TokenBalanceFactory.build(**kwargs)
    session.add(obj)
    await session.flush()
    return obj


async def create_unallocated_pool(session: AsyncSession, **kwargs) -> UnallocatedPool:
    obj = UnallocatedPoolFactory.build(**kwargs)
    session.add(obj)
    await session.flush()
    return obj


async def create_withdrawal(session: AsyncSession, **kwargs) -> Withdrawal:
    obj = WithdrawalFactory.build(**kwargs)
    session.add(obj)
    await session.flush()
    return obj


async def create_metal_price(
    session: AsyncSession,
    metal: Metal = Metal.gold,
    price_usd_per_troy_oz: float = 1960.0,
    **kwargs,
) -> MetalPrice:
    from datetime import datetime, timezone
    obj = MetalPrice(
        metal=metal,
        price_usd_per_troy_oz=price_usd_per_troy_oz,
        fetched_at=kwargs.get("fetched_at", datetime.now(timezone.utc)),
        raw_response=kwargs.get("raw_response"),
    )
    session.add(obj)
    await session.flush()
    return obj
