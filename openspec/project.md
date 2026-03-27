# Project Context

## Purpose
Bare Metals is a digital asset custody platform for Bare Metals Pvt, built for the Maldives Securities Depository assessment. It digitizes the management of precious metal (gold, silver, platinum) storage across multiple physical vaults. The platform manages customer accounts, deposits and withdrawals, live asset valuation, and vault inventory — supporting both retail (unallocated/pooled) and institutional (allocated/bar-level) storage models.

## Tech Stack
- **Backend:** Python, FastAPI, SQLAlchemy (ORM), Alembic (migrations)
- **Frontend:** React, TypeScript, TailwindCSS, shadcn/ui, Leaflet.js
- **Database:** PostgreSQL (via Docker)
- **Auth:** JWT (HS256), role-based access control
- **External API:** metalpriceapi.com (metal spot prices, cached in DB)
- **Infrastructure:** Docker + Docker Compose (single-command startup)

## Project Conventions

### Code Style
- Backend follows standard Python conventions (PEP 8)
- API responses use `snake_case` JSON keys
- Enums for metals: `gold | silver | platinum`
- Enums for roles: `admin | ops | client`
- Enums for account types: `retail | institutional`
- Enums for storage types: `allocated | unallocated`
- Token unit: `1 token = 0.1g` — all retail quantities stored and computed as integers to avoid floating-point issues
- Bar weights (`weight_g`) stored as DECIMAL for legal accuracy; never used in computation

### Architecture Patterns
- REST / JSON API between frontend and backend
- SQLAlchemy ORM with row-level locking (`SELECT ... FOR UPDATE`) for concurrent withdrawal safety
- `token_balances` is a maintained cache (updated atomically in the same transaction as every deposit/withdrawal); source of truth is always `SUM(deposits) - SUM(withdrawals)`
- Pool model: each vault maintains an independent pool per metal for unallocated storage
- Price caching: external price fetched at most once per configurable TTL; last successful fetch always served — never zero prices
- Soft deletes only: vaults and accounts are never hard deleted; deactivation is blocked if active holdings exist
- Deposits are immutable — withdrawals are separate records

### Testing Strategy
- **TDD workflow:** write the failing test first, then implement until it passes
- **Framework:** `pytest` + `pytest-asyncio` + `httpx` (async test client against FastAPI)
- **Factories:** `factory-boy` for generating model instances in tests
- **Isolation:** each test runs inside a transaction that is rolled back after the test; no shared state between tests
- **External API mocking:** `metalpriceapi.com` client is mocked in all tests; integration with the live API is never required to run the test suite
- **Coverage:** enforced via `pytest-cov`; target ≥ 80% line coverage
- **Test layout:** mirrors app structure — `tests/test_auth.py`, `tests/test_accounts.py`, etc.

### Git Workflow
[To be defined]

## Domain Context
- **Unallocated (retail):** Pooled storage. Client holds tokens representing a fraction of a shared pool at a vault. 1 token = 0.1g. Partial withdrawals down to 0.1g are supported. Cannot be used by institutional accounts.
- **Allocated (institutional):** Bar-level storage. Client holds specific physical bars identified by serial number and weight. Tokens are not used. Cannot be used by retail accounts.
- **Vault:** A physical storage facility with a geographic location (lat/lng) in the Maldives. Each vault tracks pool totals per metal.
- **Valuation:** Prices are fetched in USD per troy oz from metalpriceapi.com; converted to per-kg internally. MVR/USD rate is stored in `system_config` and applied client-side.
- **Account types:** Retail clients use unallocated storage. Institutional clients use allocated storage. Ops and admin accounts have no account type.

## Important Constraints
- Retail accounts can only use unallocated (pooled) storage; institutional accounts can only use allocated (bar-level) storage — enforced at the service layer on every deposit request
- A vault's pool must have sufficient tokens to cover a retail withdrawal, even if the client's own balance is sufficient (pool-level guard prevents over-commitment)
- Bar serial numbers are globally unique (`UNIQUE` constraint in DB); duplicate serial number returns HTTP 409
- `token_amount` of zero or below is rejected before any DB write
- Accounts and vaults cannot be deactivated if they hold active holdings
- No client self-registration — all accounts created by admin
- Password reset is out of scope
- Cross-vault transfers are out of scope

## External Dependencies
- **metalpriceapi.com** — spot price feed for gold, silver, platinum. Cached in `metal_prices` table with configurable TTL (default 24h). On unavailability, serves last cached price with `stale: true` flag. If no cached price exists, valuation endpoints return an error.
- **Docker / Docker Compose** — required to run the full stack (DB migrations and admin seed run automatically on first boot)
- **Default admin seed:** `admin@baremetals.mv` / `changeme123` (created on first boot)
