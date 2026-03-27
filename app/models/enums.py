import enum

from sqlalchemy import Enum as SAEnum


class Role(str, enum.Enum):
    admin = "admin"
    ops = "ops"
    client = "client"


class AccountType(str, enum.Enum):
    retail = "retail"
    institutional = "institutional"


class Metal(str, enum.Enum):
    gold = "gold"
    silver = "silver"
    platinum = "platinum"


class StorageType(str, enum.Enum):
    allocated = "allocated"
    unallocated = "unallocated"


# Shared SA enum types — reusing the same object ensures the PG ENUM is created once
RoleEnum = SAEnum(Role, name="role_enum")
AccountTypeEnum = SAEnum(AccountType, name="account_type_enum")
MetalEnum = SAEnum(Metal, name="metal_enum")
StorageTypeEnum = SAEnum(StorageType, name="storage_type_enum")
