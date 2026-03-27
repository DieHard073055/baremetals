"""
factory-boy factories for all core models.

Usage in tests:
    AccountFactory._meta.sqlalchemy_session = db_session
    account = await AccountFactory.create(role=Role.ops)

Token fixtures (Task 2+) will wire the session automatically via conftest.
"""
import bcrypt
import factory
from factory.alchemy import AsyncSQLAlchemyModelFactory

from app.models.account import Account
from app.models.deposit import AllocatedBar, Deposit, TokenBalance
from app.models.enums import AccountType, Metal, Role, StorageType
from app.models.vault import UnallocatedPool, Vault
from app.models.withdrawal import Withdrawal, WithdrawalBar

# Pre-hashed "password123" — computed once to avoid per-factory bcrypt overhead
_DEFAULT_HASH = bcrypt.hashpw(b"password123", bcrypt.gensalt()).decode()


class AccountFactory(AsyncSQLAlchemyModelFactory):
    class Meta:
        model = Account
        sqlalchemy_session = None
        sqlalchemy_session_persistence = "commit"

    name = factory.Faker("name")
    email = factory.Sequence(lambda n: f"user{n}@example.com")
    password_hash = _DEFAULT_HASH
    role = Role.client
    account_type = AccountType.retail
    is_active = True
    created_by = None


class VaultFactory(AsyncSQLAlchemyModelFactory):
    class Meta:
        model = Vault
        sqlalchemy_session = None
        sqlalchemy_session_persistence = "commit"

    name = factory.Sequence(lambda n: f"Vault {n}")
    latitude = factory.Faker("latitude")
    longitude = factory.Faker("longitude")
    is_active = True
    created_by = None


class UnallocatedPoolFactory(AsyncSQLAlchemyModelFactory):
    class Meta:
        model = UnallocatedPool
        sqlalchemy_session = None
        sqlalchemy_session_persistence = "commit"

    vault_id = None  # must be set by caller
    metal = Metal.gold
    total_tokens = 0


class DepositFactory(AsyncSQLAlchemyModelFactory):
    class Meta:
        model = Deposit
        sqlalchemy_session = None
        sqlalchemy_session_persistence = "commit"

    deposit_number = factory.Sequence(lambda n: f"DEP-{n:06d}")
    account_id = None  # must be set by caller
    vault_id = None    # must be set by caller
    metal = Metal.gold
    storage_type = StorageType.unallocated
    token_amount = 10000  # 1 kg
    created_by = None  # must be set by caller


class AllocatedBarFactory(AsyncSQLAlchemyModelFactory):
    class Meta:
        model = AllocatedBar
        sqlalchemy_session = None
        sqlalchemy_session_persistence = "commit"

    deposit_id = None  # must be set by caller
    serial_number = factory.Sequence(lambda n: f"BAR-{n:06d}")
    weight_g = 1000.0


class TokenBalanceFactory(AsyncSQLAlchemyModelFactory):
    class Meta:
        model = TokenBalance
        sqlalchemy_session = None
        sqlalchemy_session_persistence = "commit"

    account_id = None  # must be set by caller
    metal = Metal.gold
    balance = 0


class WithdrawalFactory(AsyncSQLAlchemyModelFactory):
    class Meta:
        model = Withdrawal
        sqlalchemy_session = None
        sqlalchemy_session_persistence = "commit"

    account_id = None  # must be set by caller
    vault_id = None
    metal = Metal.gold
    storage_type = StorageType.unallocated
    token_amount = 1000
    created_by = None  # must be set by caller


class WithdrawalBarFactory(AsyncSQLAlchemyModelFactory):
    class Meta:
        model = WithdrawalBar
        sqlalchemy_session = None
        sqlalchemy_session_persistence = "commit"

    withdrawal_id = None  # must be set by caller
    bar_id = None         # must be set by caller
